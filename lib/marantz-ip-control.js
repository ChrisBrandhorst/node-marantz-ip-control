'use strict'

const EventEmitter  = require('events'),
      net           = require('net'),
      debounce      = require('debounce'),
      Command       = require('./command'),
      Processor     = require('./processor')
require('./processors')


module.exports = class MarantzIPController extends EventEmitter {

  //
  constructor(options) {
    super();

    options = options || {}

    // TODO: error handling for missing / invalid options

    this.host = options.host

    this.status = {
      'power':                          false,
      'volume.master':                  0,
      'volume.master.max':              0,
      'volume.mute':                    false,
      'volume.subwoofer.level':         0,
      'volume.subwoofer.level.enabled': false,
      'surroundMode':                   null,
      'source':                         null
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
    var cmd = Command.get("request", prop)
    return writeAndWait(this, prop, cmd, true, callback)
  }


  /**
   * 
   */
  act(prop, val, callback) {
    var cmd = Command.get("action", prop)
    if (typeof val == 'function')
      callback = val
    else if (val)
      cmd = cmd.replace("%s", Command.prepareValue(val))
    return writeAndWait(this, prop, cmd, false, callback)
  }


  /**
   * Request the basic properties of the receiver.
   */
  requestBasics() {
    this.request('power')
    this.request('volume.master')
    this.request('volume.subwoofer.level')
    this.request('surroundMode')
    this.request('source')
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


  /**
   * Sets a property on the controller status and emits event handlers for the update.
   * Should only be called because a change occured on the receiver end.
   */
  set(prop, val) {
    if (this.status[prop] !== val) {
      this.status[prop] = val
      this.emit('update.' + prop, val)
      this.emitStatusUpdate()
    }
    return val
  }

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
function writeAndWait(controller, prop, command, expectResponse, callback) {
  controller.ensureConnected()
  return new Promise( (resolve) => {
    if (expectResponse) {
      Processor.find(prop).addResolver( (result) => {
        if (typeof callback == 'function')
          callback(result)
        resolve(result)
      })
    }
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

  Processor.forAll( (processor, prop) => {
    var matchData = response.match( processor.resp )
    if (matchData) {
      var result = processor.proc(controller, prop, matchData, response)
      processor.resolve(result)
      return false;
    }
  })

}