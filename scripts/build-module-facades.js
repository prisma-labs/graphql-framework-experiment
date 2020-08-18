/**
 * Module Facades
 *
 * This script builds the modules that will be consumed publically. They front
 * the actual code inside ./dist. The problem being solved here is that it
 * allows consumers to do e.g. this:
 *
 *    import { ... } from 'nexus/testing'
 *
 * Instead of:
 *
 *    import { ... } from 'nexus/dist/testing'
 *
 * Whatever modules are written here should be:
 *
 *    1. ignored in .gitignore.
 *    2. added to the package.json files array
 */

const fs = require('fs-jetpack')
const os = require('os')
const lo = require('lodash')
const path = require('path')

// prettier-ignore
const facades = [
  ['testing.d.ts',            "export * from './dist/testing'"                        + os.EOL],
  ['testing.js',              "module.exports = require('./dist/testing')"            + os.EOL],

  ['plugin.d.ts',             "export * from './dist/plugin'"                         + os.EOL],
  ['plugin.js',               "module.exports = require('./dist/plugin')"             + os.EOL],

  ['components/schema.d.ts',  "export * from '../dist/components/schema'"             + os.EOL],
  ['components/schema.js',    "module.exports = require('../dist/components/schema')" + os.EOL],

  ['components/logger.d.ts',  "export * from '../dist/components/logger'"             + os.EOL],
  ['components/logger.js',    "module.exports = require('../dist/components/logger')" + os.EOL],

  ['typescript-language-service/index.d.ts',  "export * from './dist/typescript-language-service'"             + os.EOL],
  ['typescript-language-service/index.js',    "module.exports = require('./dist/typescript-language-service')" + os.EOL],
]

// Write facade files

for (const facade of facades) {
  fs.write(facade[0], facade[1])
}

// Handle package.json files array

const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = fs.read(packageJsonPath, 'json')

packageJson.files = lo.uniq([...packageJson.files, ...facades.map((facade) => facade[0])])

const packageJsonString = JSON.stringify(packageJson, null, 2) + os.EOL

fs.write(packageJsonPath, packageJsonString)
