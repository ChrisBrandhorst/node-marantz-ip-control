"use strict"

const MarantzController = require('../lib/marantz-ip-control')

var controller = new MarantzController({
  host: "10.1.1.165"
})

controller.connect().then( (socket) => {
  console.log("Connected impl")

  // controller.disconnect()
  // socket.end()

  // controller.requestBasics()

  controller.getPower( (power) => {
    console.log("CALB: Power is O" + (power ? "N" : "FF") )
  }).then( (power) => {
    console.log("PROM: Power is O" + (power ? "N" : "FF") )
  })

})
