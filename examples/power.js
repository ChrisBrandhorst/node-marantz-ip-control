"use strict"

const MarantzController = require('../lib/marantz-ip-control')

var controller = new MarantzController({
  host: "10.1.1.165"
  // host: "127.0.0.1"
})

controller.on('update', (status) => {
  console.log(status)
})

controller.on('error', (err) => {
  console.error(err)
})

controller.on('close', (err) => {
  console.error("Closed!")
})

controller.connect().then( (socket) => {
  console.log("Connected impl")

  controller.request('power', (power) => {
    console.log("CALB: Power is O" + (power ? "N" : "FF") )
  }).then( (power) => {
    console.log("PROM: Power is O" + (power ? "N" : "FF") )
  })

  setTimeout(function(){

    controller.act('masterVolume', 24)

  }, 1000)

})
