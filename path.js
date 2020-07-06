const os = require('os')
const fs = require('fs')

console.log({
    tmp: os.tmpdir(),
    runner1: fs.readdirSync('C:\\Users\\RUNNER~1'),
    runneradmin: fs.readdirSync('C:\\Users\\runneradmin'),
    test: fs.readlinkSync('C:\\Users\\RUNNER~1')
})