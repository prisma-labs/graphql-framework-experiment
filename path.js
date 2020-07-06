const os = require('os')
console.log({
    filename: __filename,
    tmp: os.tmpdir(),
    cwd: process.cwd(),
    env: process.env
})