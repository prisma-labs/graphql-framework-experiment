import { register } from 'ts-node'

/**
 * Use ts-node register to require .ts file and transpile them "on-the-fly"
 */
register({
  transpileOnly: true,
})

export { Plugin } from './plugin'
export * from './app'
