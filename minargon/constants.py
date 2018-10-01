from . import app
import tools


# Detector Stuff

# FOR TESTING ON NEVIS DATA
"""
N_CHANNELS = 16
N_CHANNELS_PER_FEM = 16
N_FEM_PER_BOARD = 1
N_BOARDS = 1
"""
# FOR VST
N_CHANNELS = 480
N_FEM_PER_CRATE = 10
N_CRATES = 1
# only one crate of readout electronics
N_FEM = N_FEM_PER_CRATE
# number of channels on each FEM (not all are used)
N_CHANNELS_PER_FEM = 64
# Slot id of zeroth slot
SLOT_OFFSET = 4

# For Lariat TPC
N_WIRES_PER_PLANE = 240

# channel mapping
CHANNEL_MAP_FNAME = app.config["CHANNEL_MAP_FNAME"]
(channel_to_wire, wire_to_channel, N_CHANNELS_PER_FEM, FEM_ACTIVE_CHANNELS) = tools.parse_channel_map_file(CHANNEL_MAP_FNAME, N_CHANNELS_PER_FEM, N_FEM, SLOT_OFFSET)

# (channel_to_wire, wire_to_channel, N_CHANNELS_PER_FEM, FEM_ACTIVE_CHANNELS) = tools.default_channel_map(N_CHANNELS, N_FEM)

detector = {
  'n_channels': N_CHANNELS,
  'n_channel_per_fem': N_CHANNELS_PER_FEM,
  'n_fem_per_crate': N_FEM_PER_CRATE,
  'n_crates': N_CRATES,
  'induction': {
     'offset': 0,
     'n_wires': N_WIRES_PER_PLANE,
   },
  'collection': {
     'offset': N_WIRES_PER_PLANE,
     'n_wires': N_WIRES_PER_PLANE,
   },
   'combined': {
     'offset': 0,
     'n_wires': N_WIRES_PER_PLANE * 2,
   },
   'channel_to_wire': channel_to_wire,
   'wire_to_channel': wire_to_channel,
   'fem_active_channels': FEM_ACTIVE_CHANNELS,
}

