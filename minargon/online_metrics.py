from . import app
from flask import jsonify, Response, request
from redis import Redis
import json
from tools import parseiso, parseiso_or_int, stream_args

import redis_api
if "REDIS_PASSWORD" in app.config:
    redis = Redis(host=app.config["REDIS_HOST"], port=int(app.config["REDIS_PORT"]), password=app.config["REDIS_PASSWORD"])
else:
    redis = Redis(host=app.config["REDIS_HOST"], port=int(app.config["REDIS_PORT"]))
PROGRAMS = []

"""
	Routes for getting stuff from Redis
"""

@app.route('/online/test_redis')
def test_redis():
    try:
        x = redis.get("foo")
    except Exception, err:
        sys.stderr.write('ERROR: %sn' % str(err))
        raise Exception("Redis cannot get foo")
    return str(x)

# get a datum stored in a snapshot
@app.route('/online/snapshot/<data>')
def snapshot(data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /snapshot/waveform?wire=1
    # decodes to the redis key snapshot:waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    return jsonify(values=redis_api.get_key(redis, redis_key))


def get_min_end_time(data):
    min_end_time = 0
    for _, val in data.items():
        if len(val) == 0:
            continue
        this_end_time = val[-1][0]
        if min_end_time == 0 or this_end_time < min_end_time:
            min_end_time = this_end_time
    return min_end_time


def front_end_key_api(data):
    ret = {}
    # transform internal key representation into representation for front end
    for key, series in data.items():
        info = key.split(":")
        metric = info[2]
        field = info[1]
        if metric not in ret:
            ret[metric] = {}
        ret[metric][field] = series

    return ret

# get data from a stream
@app.route('/online/stream/<name>')
def stream(name):
    args = stream_args(request.args)
    data = redis_api.get_streams(redis, [name], **args)
    min_end_time = get_min_end_time(data)

    return jsonify(values=data,min_end_time=min_end_time)

# get data and subscribe to a stream
@app.route('/online/stream_subscribe/<name>')
def stream_subscribe(name):
    args = stream_args(request.args)
    def event_stream():
        for data in redis_api.subscribe_streams(redis, [name], **args):
            min_end_time = get_min_end_time(data)
            ret = {}
            ret["values"] = data
            ret["min_end_time"] = min_end_time
            ret = "data: %s\n\n" % json.dumps(ret)
            yield ret 
    # sometiems this won't work if the client disconnects from the stream un-gracefully
    # TODO: how to detect?
    return Response(event_stream(), mimetype="text/event-stream")

# get a simple key
@app.route("/key/<keyname>")
def key(keyname):
    return jsonify(value=redis_api.get_key(redis, keyname))

@app.route('/online/stream_group_subscribe/<stream_type>/<list:metric_names>/<instance_name>/<int:field_start>/<int:field_end>')
@app.route('/online/stream_group_subscribe/<stream_type>/<list:metric_names>/<instance_name>/<list:field_list>')
def stream_group_subscribe(stream_type, metric_names, instance_name, field_start=None, field_end=None, field_list=None):
    args = stream_args(request.args)

    if field_list is not None:
        fields = field_list
    else: 
        fields = [str(x) for x in range(field_start, field_end)]

    stream_names = []
    for metric in metric_names:
        for inst in fields:
            this_stream_name = "%s:%s:%s:%s" % (instance_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    def event_stream():
        for data in redis_api.subscribe_streams(redis, stream_names, **args):
            min_end_time = get_min_end_time(data)
            values = front_end_key_api(data)
            ret = {}
            ret["values"] = values
            ret["min_end_time"] = min_end_time
            ret = "data: %s\n\n" % json.dumps(ret)
            yield ret 

    # sometiems this won't work if the client disconnects from the stream un-gracefully
    # TODO: how to detect?
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/online/stream_group/<stream_type>/<list:metric_names>/<instance_name>/<int:field_start>/<int:field_end>')
@app.route('/online/stream_group/<stream_type>/<list:metric_names>/<instance_name>/<list:field_list>')
def stream_group(stream_type, metric_names, instance_name, field_start=None, field_end=None, field_list=None):
    args = stream_args(request.args)

    if field_list is not None:
        fields = field_list
    else: 
        fields = [str(x) for x in range(field_start, field_end)]

    stream_names = []
    for metric in metric_names:
        for inst in fields:
            this_stream_name = "%s:%s:%s:%s" % (instance_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    data = redis_api.get_streams(redis, stream_names, **args)

    # get the least most updated stream for the front end
    min_end_time = get_min_end_time(data)

    values = front_end_key_api(data)

    return jsonify(values=values, min_end_time=min_end_time)

@app.route('/online/infer_step_size/<stream_type>/<metric_name>/<instance_name>/<field_name>')
@app.route('/online/infer_step_size/<stream_name>')
def infer_step_size(stream_name=None, stream_type=None, metric_name=None, instance_name=None, field_name=None):
    if stream_name is None:
        key = "%s:%s:%s:%s" % (instance_name, field_name, metric_name, stream_type)
    else: 
        key = stream_name
    data = redis_api.get_last_streams(redis, [key], count=3)
    times = [t for t, _ in data[key]] 
    
    if len(times) < 2:
        avg_delta_times = 0
    else:
        sum_delta_times = 0
        n_differences = 0
        for i in range(len(times) - 1):
            # HOTFIX -- TODO: make better
            this_difference = int(times[i]) - int(times[i+1])
            if this_difference < 10: 
              continue

            n_differences += 1
            sum_delta_times += int(times[i]) - int(times[i+1])
        if n_differences > 0:
            avg_delta_times = sum_delta_times / (len(times) - 1)
        else:
            avg_delta_times = 0
    return jsonify(step=avg_delta_times)

# internal API for accessing series associated with an instance
def get_series(instance_link, field_link):
    time_series = redis.keys("%s:%s:*" % (instance_link, field_link)) 
    ret = {}
    # name of api link to access the stream
    stream_link = "/online"
    for key in time_series:
        split = key.split(":")
        metric = split[2]
        stream_type = split[3]
        if metric in ret:
            ret[metric].append((stream_type, stream_link))
        else:
            ret[metric] = [(stream_type, stream_link)]
    return ret
    


