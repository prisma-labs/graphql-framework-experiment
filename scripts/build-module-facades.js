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
 * Whatever modules are written here should be ignored in .gitignore.
 */

const fs = require('fs-jetpack')
const { stripIndent } = require('common-tags')

// testing

fs.write(
  'testing.d.ts',
  stripIndent`
    export * from './dist/testing'
  `
)

fs.write(
  'testing.js',
  stripIndent`
    module.exports = require('./dist/testing')
  `
)

// plugin

fs.write(
  'plugin.d.ts',
  stripIndent`
    export * from './dist/plugin'
  `
)

fs.write(
  'plugin.js',
  stripIndent`
    module.exports = require('./dist/plugin')
  `
)
