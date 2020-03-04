/**
 * See README for why this hack exists.
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'dist', 'cli', 'main.js')

const contents = fs.readFileSync(filePath, {
  encoding: 'utf8',
})

const contentsFixed = contents
  .replace(/"use strict";\n/g, '')
  .replace("':';", "':'")

fs.writeFileSync(filePath, contentsFixed)
