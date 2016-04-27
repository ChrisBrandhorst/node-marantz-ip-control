"use strict"

const MarantzController = require('../lib/marantz-ip-control')

var controller = new MarantzController({
  host: "10.1.1.165"
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

})



var stdin = process.stdin.setEncoding('utf8')
stdin
  .on('readable', function () {
    var chunk = stdin.read()
    if (chunk === null) return

    var cmd   = chunk.toString().replace(/[\n\r]*$/, ''),
        parts = cmd.split(" ")

    controller.act(parts[0], parts[1])
  })

  .on('end', function () {
    log.info('Stdin closed..');
  });
