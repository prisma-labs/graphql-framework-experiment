const { join } = require('path')
const { fork } = require('child_process')

const scriptPath = join(__dirname, 'postinstall-typegen-script.js')
// Run typegen in a sub-process to avoid any potential errors during install
const cp = fork(scriptPath, [], { stdio: 'inherit' })
// Unref the child process to allow NodeJS to gracefully exits immediately, leaving the subprocess as an orphan child.
// The sub-process has a timeout of 10s before it exits anyway if anything goes wrong
cp.unref()
process.exit(0)
