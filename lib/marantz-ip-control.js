"use strict"

const EventEmitter  = require('events'),
      net           = require('net')

// const requests = {
//   spaced:     "DIM MSSMART PSAUROPR PSAUROST PSBAS PSBSC PSCEG PSCEI PSCEN PSCES PSCINEMA EQ. PSCNTAMT PSDCO PSDEH PSDELAY  PSDIC PSDIL PSDIM PSDRC PSDSX PSDYNEQ PSDYNVOL PSFH: PSGEQ PSHEQ PSHTEQ PSLFC PSLFE PSLFL PSLOM PSMDAX PSMODE: PSMULTEQ: PSNEURAL PSPAN PSPHG PSREFLEV PSSP: PSSTH PSSTW PSSWL PSSWR PSTONE CTRL PSTRE PVBR PVCM PVCN PVDNR PVENH PVHUE PVST RM SSBLN SSCVO SSHOS SSOSD VSASP VSAUDIO VSMONI VSSC VSSCH VSVPM VSVST Z2PSBAS Z2PSTRE Z2SMART Z3PSBAS Z3PSTRE Z3SMART".split(" ")
//   nonSpaced:  "ANNAME CV DC ECO HD MNMEN MNPRV MNZST MS MU MV PSFRONT PV PW SD SI SLP ST STBY SV TFAN TFHD TFST TMAN TMHD TPAN TPHD TPST TR Z2 Z2CS Z2CV Z2HPF Z2MU Z2SLP Z2STBY Z3 Z3CS Z3CV Z3HPF Z3MU Z3SLP Z3SLP Z3STBY Z4 ZM".split(" ")
// }

const Command = {
  REQ_POWER:          "ZM?",
  REQ_MASTER_VOLUME:  "MV?",
  REQ_SUB_LEVEL:      "PSSWL ?",
  REQ_SOUND_MODE:     "MS?",
  REQ_SOURCE:         "SI?"
}

class MarantzIPController extends EventEmitter {

  //
  constructor(options) {
    super();

    options = options || {}

    // TODO: error handling for missing / invalid options

    this.host = options.host

    this.status = {
      power:            false,
      masterVolume:     0,
      subLevel:         0,
      subLevelEnabled:  false,
      soundMode:        null,
      source:           null
    }
  }


  /*
   * Start a connection to the receiver.
   * Only one connection can be present at any time.
   */
  connect(callback) {
    var self = this;

    return new Promise( (resolve) => {
      if (self.socket) self.emit('error', "Cannot connect: a connection is already present")

      self.socket = net.connect(23, self.host, () => {
        console.log("Connect func")
        if (typeof callback == 'function') callback(self)
        resolve(self)
      })

      self.socket.on('close', (had_error) => {
        console.log("Close")
        delete self.connection
        self.connected = false
        // TODO: auto reconnect
      })

      self.socket.on('connect', () => {
        console.log("Connect event")
        self.connected = true
        self.requestBasics()
      })

      self.socket.on('data', (data) => {
        read(self, data)
        // TODO: process data
      })

      self.socket.on('error', (error) => {
        console.log("Error")
        self.emit('error', "Socket error: " + error)
        self.socket.destroy()
      })

      self.socket.on('timeout', () => {
        console.log("Timeout")
        self.emit('timeout')
        self.socket.end()
      })

      return self
    })
  }


  //
  disconnect() {
    if (!this.socket) return
    socket.destroy()
  }


  /**
   * Request the basic properties of the receiver.
   */
  requestBasics() {
    this.getPower()
    this.getVolume()
    this.getSubLevel()
    this.getSubLevelEnabled()
    this.getSoundMode()
    this.getSource()
  }


  // Some basic get commands
  getPower(callback)            { return writeAndWait(this, Command.REQ_POWER, callback) }
  getVolume(callback)           { return writeAndWait(this, Command.REQ_MASTER_VOLUME, callback) }
  getSubLevel(callback)         { return writeAndWait(this, Command.REQ_SUB_LEVEL, callback) }
  getSubLevelEnabled(callback)  { return writeAndWait(this, Command.REQ_SUB_LEVEL, callback) }
  getSoundMode(callback)        { return writeAndWait(this, Command.REQ_SOUND_MODE, callback) }
  getSource(callback)           { return writeAndWait(this, Command.REQ_SOURCE, callback) }

}


/**
 * The brains of it all.
 * For each command that results in some response, this command is given as a key. The linked object
 * contains a regex on which responses from the receiver will be matched (resp).
 * If a match occurs, the proc method will be called. This method should return the value of the
 * setting related to the command and might adjust the status of the controller.
 */
const processors = { }

// Power: true / false
processors[Command.REQ_POWER] = {
  resp: /^ZM(ON|OFF)$/,
  proc: (c,m,r) => {
    return c.status.power = m[1] == "ON"
  }
}

// Master volume: 0 - 98 in .5 increments, corresponding to -80dB - 18dB
processors[Command.REQ_MASTER_VOLUME] = {
  resp: /^MV(\d{2,3})$/,
  proc: (c,m,r) => {
    var vol = parseInt(m[1])
    if (vol > 100) vol = vol / 10
    return c.status.masterVolume = vol
  }
}

// Subwoofer level: 38 - 62, corresponding to -12dB - 12dB
processors[Command.REQ_SUB_LEVEL] = {
  resp: /^PSSWL (\d{2})$/,
  proc: (c,m,r) => {
    return c.status.subLevel = m[1]
  }
}

// Subwoofer level enabled: true / false
processors["SUB_LEVEL_ENABLED"] = {
  resp: /^PSSWL (ON|OFF)$/,
  proc: (c,m,r) => {
    return c.status.subLevelEnabled = m[1] == "ON"
  }
}

// Sound mode
processors[Command.REQ_SOUND_MODE] = {
  resp: /^MS(.*)$/,
  proc: (c,m,r) => {
    return c.status.soundMode = m[1]
  }
}

// Source
processors[Command.REQ_SOURCE] = {
  resp: /^SI(.*)$/,
  proc: (c,m,r) => {
    return c.status.source = m[1]
  }
}


/**
 * Contains resolvers which are waiting for a response from the receiver.
 */
var procResolvers = {}
for( var cmd in processors ) procResolvers[cmd] = [];


/**
 * Used to ensure there is an active connection with the receiver before sending.
 */
function ensureConnected(controller) {
  if (!controller.socket || !controller.connected) throw new Error('error', "Unable to execute method: no connection")
}


/**
 * Write a command to the socket.
 */
function write(controller, command) {
  console.log(command + " -->")
  controller.socket.write(command + "\r");
}


/**
 * Writes a command to the socket and registers the given callback or promise handler
 * with the response handler in order for the corresponding response to be returned.
 */
function writeAndWait(controller, command, callback) {
  ensureConnected(controller)
  return new Promise( (resolve) => {

    procResolvers[command].push( (result) => {
      if (typeof callback == 'function')
        callback(result)
      resolve(result)
    })
    write(controller, command)

  })
}


/**
 * Processes responses from the socket. The response is fed through all available 
 * processors until the response matches the regex for that processor. The processor
 * is then called and any callbacks / promise handlers are invoked.
 */
function read(controller, response) {
  response = response.toString().replace( /[\x00\s]*$/, "")
  console.log("--> " + response)

  for( var cmd in processors ) {
    
    var processor = processors[cmd],
        matchData = response.match( processor.resp )

    if (matchData) {
      var result = processor.proc(controller, matchData, response)
      
      var cmdResolvers = procResolvers[cmd]
      for ( var i in cmdResolvers )
        cmdResolvers[i](result)
      procResolvers[cmd] = []

      break;
    }

  }

  // console.log(controller.status)
}



// Exports
module.exports = MarantzIPController;