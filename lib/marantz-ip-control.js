'use strict'

const EventEmitter  = require('events'),
      net           = require('net'),
      debounce      = require('debounce'),
      Command       = require('./commands'),
      processors    = require('./processors')


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
      masterVolumeMax:  0,
      mute:             false,
      subLevel:         0,
      subLevelEnabled:  false,
      soundMode:        null,
      source:           null
    }

    this.emitStatusUpdate = debounce(this.emitStatusUpdate, 100)
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
    var req = "REQ_" + prop.replace(/([A-Z])/g, "_$1").toUpperCase()
    if (!Command[req]) throw new Error("Unknown command " + req)
    return writeAndWait(this, Command[req], callback)
  }


  /**
   * Request the basic properties of the receiver.
   */
  requestBasics() {
    this.request('power')
    this.request('masterVolume')
    this.request('subLevel')
    this.request('soundMode')
    this.request('source')
  }


  /**
   * Returns the current value of a status property.
   */
  get(prop) {
    return this.status[prop]
  }


  /**
   * Sets a property on the controller status and emits event handlers for the update.
   */
  set(prop, val) {
    if (this.status[prop] !== val) {
      this.status[prop] = val
      this.emit('update.' + prop, val)
      this.emitStatusUpdate()
    }
    return val
  }


  /**
   * Emit the current status. This method is debounced.
   */
  emitStatusUpdate() {
    this.emit('update', this.status)
  }


  /**
   * Used to ensure there is an active connection with the receiver before sending.
   */
  ensureConnected() {
    if (!this.socket || !this.connected) throw new Error('error', "Unable to execute method: no connection")
  }

}


/**
 * Contains resolvers which are waiting for a response from the receiver.
 */
var procResolvers = {}
for( var cmd in processors ) procResolvers[cmd] = [];


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
  controller.ensureConnected()
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
module.exports = MarantzIPController