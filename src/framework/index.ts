import { createApp } from './app'

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
