'use strict'

const IPController  = require('../../node-ip-controller'),
      Command       = require('./command'),
      processors    = require('./processors'),

      startStatus   = {
        'power':                          false,
        'volume.master':                  0,
        'volume.master.max':              0,
        'volume.mute':                    false,
        'volume.subwoofer.level':         0,
        'volume.subwoofer.level.enabled': false,
        'surroundMode':                   null,
        'source':                         null
      },

      defaultOptions  = {
        port:               23,
        reconnectInterval:  30 * 1000
      }


module.exports = class MarantzIPController extends IPController {

  /**
   *
   */
  constructor(options) {
    super(defaultOptions, options, startStatus, processors)
    var self = this

    self.on('connect', () => {
      self.requestBasics()
    })

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
   * 
   */
  getRequestCommand(prop) {
    return Command.get("request", prop)
  }


  /**
   * 
   */
  getActCommand(prop, val) {
    var cmd = Command.get("action", prop)
    if (typeof val != 'undefined')
      cmd = cmd.replace("%s", Command.prepareValue("action", prop, val))
    return cmd
  }


  /**
   *
   */
  processResponse(resp) {
    return resp.replace( /[\x00\s]*$/, "")
  }

}
