import { createApp } from './app'

// TODO Pending future discussion
// declare global {
//   interface PumpkinsSingletonApp {}
// }
//
// if (isGlobalSingletonEnabled()) {
//   app = createApp()
//   ;(app as any).installGlobally()
// }

export const app = createApp()
