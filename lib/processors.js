'use strict'

const Processor = require('./processor')

/**
 * A Processor is created based on a property key, a regex which should match the
 * response coming over the socket and a proc function which states what should be
 * done with the response.
 * The proc method should return the value of the setting related to the command
 * and might adjust the status of the controller.
 */

// Power: true / false
Processor.build(
  'power',
  /^ZM(ON|OFF)$/,
  (c,p,m,r) => {
    return c.set(p, m[1] == "ON")
  }
)

// Master volume: 0 - 98 in .5 increments, corresponding to -80dB - 18dB
Processor.build(
  'volume.master',
  /^MV(\d{2,3})$/,
  (c,p,m,r) => {
    var vol = parseInt(m[1])
    if (vol > 100) vol = vol / 10
    return c.set(p, vol)
  }
)

// Master volume max: 60, 70, 80 or 94.5
Processor.build(
  'volume.master.max',
  /^(MVMAX|SSVCTZMALIM) (\d{2,3}|OFF)$/,
  (c,p,m,r) => {
    var max = m[2] == "OFF" ? 945 : parseInt(m[2])
    if (max > 100) max = max / 10
    return c.set(p, max)
  }
)

// Master volume max: 60, 70, 80 or 94.5
Processor.build(
  'volume.mute',
  /^MU(ON|OFF)$/,
  (c,p,m,r) => {
    return c.set(p, m[1] == "ON")
  }
)

// Subwoofer level: 38 - 62, corresponding to -12dB - 12dB
Processor.build(
  'volume.subwoofer.level',
  /^PSSWL (\d{2})$/,
  (c,p,m,r) => {
    return c.set(p, parseInt(m[1]))
  }
)

// Subwoofer level enabled: true / false
Processor.build(
  'volume.subwoofer.level.enabled',
  /^PSSWL (ON|OFF)$/,
  (c,p,m,r) => {
    return c.set(p, m[1] == "ON")
  }
)

// Sound mode
Processor.build(
  'surroundMode',
  /^MS(.*)$/,
  (c,p,m,r) => {
    return c.set(p, m[1])
  }
)

// Source
Processor.build(
  'source',
  /^SI(.*)$/,
  (c,p,m,r) => {
    return c.set(p, m[1])
  }
)