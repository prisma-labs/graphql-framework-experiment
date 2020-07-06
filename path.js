const os = require('os')
const fs = require('fs')

console.log({
    tmp: os.tmpdir(),
    runner1: fs.statSync('C:\\Users\\RUNNER~1'),
    realPath: fs.realpathSync('C:\\Users\\RUNNER~1'),
    dir: fs.readdirSync('C:\\Users')
})