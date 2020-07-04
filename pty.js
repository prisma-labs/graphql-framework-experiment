const { spawn } = require('node-pty')
const path = require('path')
const fs = require('fs')
const which = require('which');
const { stdout } = require('process');



// const yarnPath = findExecutable('yarn', process.cwd())

const yarnWhich = which.sync('yarn')

const ptyProcess = spawn(yarnWhich, ['-v'])

ptyProcess.on('data', function (data) {
  process.stdout.write(data)
});

ptyProcess.on('exit', (exitCode, signal) => {
    const result = {
      exitCode: exitCode,
      signal: signal,
    }

    if (exitCode !== 0) {
      const error = new Error(`command "${command} ${args.join(' ')}" exited ${exitCode}`)
      Object.assign(error, result)
    }
  })