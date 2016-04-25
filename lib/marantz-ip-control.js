"use strict"

const EventEmitter  = require('events'),
      net           = require('net')


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
        self.emit('ready')
      })

      self.socket.on('close', (had_error) => {
        console.log("Close")
        delete self.connection
        self.connected = false
        // TODO: auto reconnect
        self.emit('close')
      })

      self.socket.on('connect', () => {
        console.log("Connect event")
        self.connected = true
        self.requestBasics()
        self.emit('connect')
      })

      self.socket.on('data', (data) => {
        read(self, data)
        self.emit('data', data)
      })

      self.socket.on('error', (error) => {
        console.log("Error")
        self.socket.destroy()
        self.emit('error', "Socket error: " + error)
      })

      self.socket.on('timeout', () => {
        console.log("Timeout")
        self.socket.end()
        self.emit('timeout')
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
   * Request a property from the receiver. Supports promises and callback
   * methods for processing of the return value, which is delivered async.
   */
  request(prop, callback) {
    var req = "REQ_" + prop.replace(/([A-Z])/, "_$1").toUpperCase()
    if (!Command[req]) throw new Error("Unknown command " + req)
    console.log(Command[req])
    return writeAndWait(this, Command[req], callback)
  }

  /**
   * Request the basic properties of the receiver.
   */
  requestBasics() {
    this.request('power')
    this.request('volume')
    this.request('subLevel')
    this.request('subLevelEnabled')
    this.request('soundMode')
    this.request('source')
  }

}


/**
 * Sets a property on the controller and emits event handlers for the update.
 */
function set(controller, prop, val) {
  if (controller.status[prop] !== val) {
    controller.status[prop] = val
    controller.emit('update.' + prop, val)
    controller.emit('update', controller.status)
  }
  return val
}


/**
 * The brains of it all.
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
const processors = { }

// Power: true / false
processors[Command.REQ_POWER] = new Processor(
  /^ZM(ON|OFF)$/,
  (c,m,r) => {
    return set(c, 'power', m[1] == "ON")
  }
)

// Master volume: 0 - 98 in .5 increments, corresponding to -80dB - 18dB
processors[Command.REQ_MASTER_VOLUME] = new Processor(
  /^MV(\d{2,3})$/,
  (c,m,r) => {
    var vol = parseInt(m[1])
    if (vol > 100) vol = vol / 10
    return set(c, 'mastVolume', vol)
  }
)

// Subwoofer level: 38 - 62, corresponding to -12dB - 12dB
processors[Command.REQ_SUB_LEVEL] = new Processor(
  /^PSSWL (\d{2})$/,
  (c,m,r) => {
    return set(c, 'subLevel', m[1])
  }
)

// Subwoofer level enabled: true / false
processors["PSSWLE ?"] = new Processor(
  /^PSSWL (ON|OFF)$/,
  (c,m,r) => {
    return set(c, 'subLevelEnabled', m[1] == "ON")
  }
)

// Sound mode
processors[Command.REQ_SOUND_MODE] = new Processor(
  /^MS(.*)$/,
  (c,m,r) => {
    return set(c, 'soundMode', m[1])
  }
)

// Source
processors[Command.REQ_SOURCE] = new Processor(
  /^SI(.*)$/,
  (c,m,r) => {
    return set(c, 'source', m[1])
  }
)


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
}



// Exports
module.exports = MarantzIPController;