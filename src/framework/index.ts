import { register } from 'ts-node'
import { createApp } from './app'

/**
 * Use ts-node register to require .ts file and transpile them "on-the-fly"
 */
register({
  transpileOnly: true,
})

// TODO Pending future discussion
// declare global {
//   interface PumpkinsSingletonApp {}
// }
//
// if (isGlobalSingletonEnabled()) {
//   pog('creating app singleton')
//   app = createApp()
//   ;(app as any).installGlobally()
// }

export const app = createApp()
export { Plugin } from './plugin'
