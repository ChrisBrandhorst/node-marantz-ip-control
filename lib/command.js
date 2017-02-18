'use strict'

const Command = {

  // Requests
  request: {
    'power':                  "ZM?",
    'volume.master':          "MV?",
    'volume.mute':            "MU?",
    'volume.subwoofer.level': "PSSWL ?",
    'surroundMode':           "MS?",
    'source':                 "SI?"
  },

  // Actions
  action: {
    'power':                  "ZM%s",
    'volume.master':          "MV%s",
    'volume.mute':            "MU%s",
    'volume.subwoofer.level': "PSSWL %s",
    'surroundMode':           "MS%s",
    'source':                 "SI%s"
  }

}

// 
Command.get = function(type, prop) {
  if (!Command[type]) throw new Error("Unknown command type:" + type)
  var cmd = Command[type][prop]
  if (typeof cmd == 'undefined') throw new Error("Unknown " + type + ": " + cmd)
  return cmd
}

//
Command.prepareValue = function(type, prop, val) {
  switch (val) {
    case true:
    case "true":
      val = "ON"
      break
    case false:
    case "false":
      val = "OFF"
      break
    default:
      val = ("" + val).toUpperCase()
  }
  return val
}

module.exports = Command