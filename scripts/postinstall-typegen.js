const { join } = require('path')
const { spawn } = require('child_process')

const scriptPath = join(__dirname, 'postinstall-typegen-script.js')
// Run the typegen generation in a sub-process to avoid any potential errors during install
const cp = spawn('node', [scriptPath], { stdio: 'inherit' })
// Unref the child process to allow NodeJS to gracefully exits immediately.
// The sub-process has a timeout of 10s before it exits anyway if anything does wrong
cp.unref()
