'use strict'

const processors  = { },
      Command     = require('./commands')

module.exports = processors

/**
 * For each command that results in some response, this command is given as a key.
 * The linked object contains a regex on which responses from the receiver will be
 * matched (resp). If a match occurs, the proc method will be called. This method
 * should return the value of the setting related to the command and might adjust
 * the status of the controller.
 */
class Processor {
  constructor(resp, proc) {
    this.resp = resp
    this.proc = proc
  }
}
Processor.create = function(cmd, resp, proc) {
  processors[cmd] = new Processor(resp, proc)
}


  /**
   * Sets a property on the controller status and emits event handlers for the update.
   */
function set(controller, prop, val) {
  if (controller.status[prop] !== val) {
    controller.status[prop] = val
    controller.emit('update.' + prop, val)
    controller.emitStatusUpdate()
  }
  return val
}


/**
 * The actual processors below this line
 * ==============================================================================
 */

// Power: true / false
Processor.create(
  Command.REQ_POWER,
  /^ZM(ON|OFF)$/,
  (c,m,r) => {
    return set(c, 'power', m[1] == "ON")
  }
)

// Master volume: 0 - 98 in .5 increments, corresponding to -80dB - 18dB
Processor.create(
  Command.REQ_MASTER_VOLUME,
  /^MV(\d{2,3})$/,
  (c,m,r) => {
    var vol = parseInt(m[1])
    if (vol > 100) vol = vol / 10
    return set(c, 'masterVolume', vol)
  }
)

// Master volume max: 60, 70, 80 or 94.5
Processor.create(
  "MVMAX ?",
  /^(MVMAX|SSVCTZMALIM) (\d{2,3}|OFF)$/,
  (c,m,r) => {
    var max = m[2] == "OFF" ? 945 : parseInt(m[2])
    if (max > 100) max = max / 10
    return set(c, 'masterVolumeMax', max)
  }
)

// Master volume max: 60, 70, 80 or 94.5
Processor.create(
  Command.REQ_MUTE,
  /^MU(ON|OFF)$/,
  (c,m,r) => {
    return set(c, 'mute', m[1] == "ON")
  }
)

// Subwoofer level: 38 - 62, corresponding to -12dB - 12dB
Processor.create(
  Command.REQ_SUB_LEVEL,
  /^PSSWL (\d{2})$/,
  (c,m,r) => {
    return set(c, 'subLevel', m[1])
  }
)

// Subwoofer level enabled: true / false
Processor.create(
  "PSSWLE ?",
  /^PSSWL (ON|OFF)$/,
  (c,m,r) => {
    return set(c, 'subLevelEnabled', m[1] == "ON")
  }
)

// Sound mode
Processor.create(
  Command.REQ_SOUND_MODE,
  /^MS(.*)$/,
  (c,m,r) => {
    return set(c, 'soundMode', m[1])
  }
)

// Source
Processor.create(
  Command.REQ_SOURCE,
  /^SI(.*)$/,
  (c,m,r) => {
    return set(c, 'source', m[1])
  }
)