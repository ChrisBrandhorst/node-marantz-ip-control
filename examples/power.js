'use strict'

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

controller.on('read', (response) => {
  console.log("--> " + response)
})

controller.on('write', (command) => {
  console.log(command + " -->")
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

    // try {
      // controller.act(parts[0], parts[1])
      controller.raw(cmd)
    // }
    // catch(e) {
    //   console.log("Unknown command: " + cmd)
    // }
  })

  .on('end', function () {
    log.info('Stdin closed..');
  });
