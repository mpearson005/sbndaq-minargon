// All code here relies on plotly.js being loaded
// TODO: make use of module imports

// class managing a plotly timeseries scatter plot
export class TimeSeriesScatter {
    constructor(target, layout, titles, n_data) {
      this.target = target;
      this.n_data = n_data;
      this.titles = titles;

      this.data = [];
      this.times = [];
      this.timestamps = [];

      for (var i = 0; i < n_data; i++) {
        this.data.push( [] );
        this.times.push( [] );
        this.timestamps.push( [] );
      }
      
      this.draw(layout);
    }

    draw(layout) {
      Plotly.newPlot(this.target, this.trace(), layout);
    }

    updateTitles(titles) { 
      this.titles = titles;
      for (var i = 0; i < this.titles.length; i++) {
        var trace_update = {
          name: this.titles
        }
        Plotly.restyle(this.target, trace_update, i);
      }
    }

    trace() {
      var ret = [];
      for (var i = 0; i < this.n_data; i++) {
        var this_trace = {
          y: this.data[i],
          x: this.times[i],
          type: 'scatter',
          name: this.titles[i]
        };
        ret.push(this_trace);
      } 
      return ret;
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    // update the data and redraw the plot
    // data should be a single time stream
    updateData(buffers) {
      for (var i = 0; i < this.n_data; i++) {
        var buffer = buffers[i];
        this.data[i].length = 0;
        this.times[i].length = 0;
        this.timestamps[i].length = 0;
        for (var j = 0; j < buffer.size; j++) {
          var dat = buffer.get(j);
          this.timestamps[i][j] = Math.round(dat[0] / 1000); // ms -> s
          this.times[i][j] = moment.unix(Math.round(dat[0] / 1000)) // ms -> s
            .format("YYYY-MM-DD HH:mm:ss");
          this.data[i][j] = dat[1];
         }
      }
      this.redraw();
      this.updateRange(this.range);
    }

    redraw() {
         Plotly.redraw(this.target);
    }

    updateRange(range) {
        if (range === undefined) {
            if (this.range !== undefined ) {
              Plotly.deleteTraces(this.target, [this.n_data, this.n_data+1]);
            }
            this.range = undefined;
            this.min = undefined;
            this.max = undefined;
            return;
        }
        var new_trace = (this.range === undefined);
        this.range = range;
        this.range_trace();
        if (new_trace) Plotly.addTraces(this.target, [this.max, this.min]);
        else Plotly.redraw(this.target);
    }

    // Internal function: reset the data for the "Warning Hi/Lo" plots 
    range_trace() {
        var min_times = [];
        var max_times = [];
        for (var i = 0; i < this.n_data; i++) {
          if (this.times[i].length > 0) min_times.push(this.timestamps[i][0]);
        }
        for (var i = 0; i < this.n_data; i++) {
          if (this.times[i].length > 0) max_times.push(this.timestamps[i][this.times[i].length-1]);
        }
        var min_time; var max_time;
        if (min_times.length > 0) {
          min_time = moment.unix(Math.min(...min_times)).format("YYYY-MM-DD HH:mm:ss");
        }
        else min_time = -1;
        if (max_times.length > 0) { 
          max_time = moment.unix(Math.max(...max_times)).format("YYYY-MM-DD HH:mm:ss");
        }
        else max_time = 10;
        
        if (this.min === undefined) {
            this.min = {
                x: [min_time, max_time],
                y: [this.range[0], this.range[0]],
	        type: "scatter", 
                name: "Warning Low",
                marker: { color: "green"},
            };
        }
        else {
            this.min.y[0] = this.range[0];
            this.min.y[1] = this.range[0];
            this.min.x[0] = min_time;
            this.min.x[1] = max_time;
        }
        if (this.max === undefined) {
            this.max = {
                x: [min_time, max_time],
                y: [this.range[1], this.range[1]],
	        type: "scatter", 
                name: "Warning High",
                marker: { color: "red"},
            };
        }
        else {
            this.max.y[0] = this.range[1];
            this.max.y[1] = this.range[1];
            this.max.x[0] = min_time;
            this.max.x[1] = max_time;
        }
    }

}

// class managing a plotly histogram
// Class managing a list of time series that plots a histogram (in
// plotly) of the most recent values across that time series 
export class Histogram {
    // n_data: the number of time series to be used
    // target: the id of the div to be drawn in (without the '#')
    // layout: the layout of the plotly histogram as defined in plotly
    //         NOTE: this variable is passed directly to the
    //         Plotly.newPlot() function 
    constructor(n_data, target, layout) {
        this.data = new Array(n_data);
        this.target = target;
        this.draw(layout);
    }
   
    // Internal function: draws the histogram for the first time
    draw(layout) {
        Plotly.newPlot(this.target, this.trace(), layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    // Internal function: get the "trace" used to draw the Plotly plot
    trace() {
        var ret = [{
            x: this.data,
            type: "histogram",
        }];
        return ret;
    }

    // update the data used in a plotly histogram
    // data: a list of CircularBuffer objects -- one for each time
    //       stream.
    // NOTE: this function is intented to be used as a listener for a 
    //       D3DataBuffer class
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            if (data[i].size > 0) {
              this.data[i] = data[i].get_last()[1];
            }
            else {
              this.data[i] = 0;
            }
        }
        this.redraw();
    }

    // Internal function: redraw the plot after changing the data 
    // (as defined in this.data)
    redraw() {
         Plotly.redraw(this.target);
    }
}

// A class managing a scatter plot of a list of timeseries where the
// most recent data point in each series is shown. Note that the scatter
// plot will go in the order of the specified list of time-series
export class LineChart {
    // n_data: the number of data points to be shown
    // target: the id of the div to be drawn in (excluding the '#')
    // layout: the layout of the plotly histogram (as defined in plotly)
    // range: (optional) the warning Hi/Lo bands to be shown on the
    // 	      plotly plot
    constructor(n_data, target, layout, range) {
        this.data = new Array(n_data);
        this.n_data = n_data;
        this.target = target;
        this.draw(layout);
        if (!(range === undefined)) {
          this.updateRange(range);
        }
    }

    // Internal function: draw the scatter plot for the first time
    draw(layout) {
        var trace = this.trace();
        Plotly.newPlot(this.target, trace, layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    // Change the range of the scatter plot
    // range: (optional) the warning Hi/Lo bands to be shown on the
    // 	      plotly plot. If range is "undefined",
    //        then the plot will switch to the default Plotly range.
    updateRange(range) {
        if (range === undefined) {
            this.range = undefined;
            this.min = undefined;
            this.max = undefined;
            Plotly.deleteTraces(this.target, [1,2]);
            return;
        }
        var new_trace = (this.range === undefined);
        this.range = range;
        this.range_trace();
        if (new_trace) Plotly.addTraces(this.target, [this.max, this.min]);
        else Plotly.redraw(this.target);
    }

    // Internal function: reset the data for the "Warning Hi/Lo" plots 
    range_trace() {
        if (this.min === undefined) {
            this.min = {
                x: [0, this.n_data-1],
                y: [this.range[0], this.range[0]],
	        type: "scatter", 
                name: "Warning Low",
                marker: { color: "green"},
            };
        }
        else {
            this.min.y[0] = this.range[0];
            this.min.y[1] = this.range[0];
        }
        if (this.max === undefined) {
            this.max = {
                x: [0, this.n_data-1],
                y: [this.range[1], this.range[1]],
	        type: "scatter", 
                name: "Warning High",
                marker: { color: "red"},
            };
        }
        else {
            this.max.y[0] = this.range[1];
            this.max.y[1] = this.range[1];
        }
    }

    // Internal function: get the traces for the scatter plot
    trace() {
        var x = [];
        for (var i = 0; i < this.n_data; i++) {
            x.push(i);
        }
        var ret = [{
            x: x,
            y: this.data,
            type: "scatter",
            name: "Data",
        }];

        if (!(this.max === undefined)) ret.append(this.max);
        if (!(this.min === undefined)) ret.append(this.min);
        return ret;
    }

    // update the data used in a plotly histogram
    // data: a list of CircularBuffer objects -- one for each time
    //       stream.
    // NOTE: this function is intented to be used as a listener for a 
    //       D3DataBuffer class
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            if (data[i].size > 0) {
              this.data[i] = data[i].get_last()[1];
            }
            else {
              this.data[i] = 0;
            } 
        }
        this.redraw();
    }

    // Internal function: redraw the plotly plot after changing the data
    redraw() {
         Plotly.redraw(this.target);
    }


}

