import { register } from 'ts-node'
import { createApp, isGlobalSingletonEnabled } from './app'
import { pog } from '../utils'

/**
 * Use ts-node register to require .ts file and transpile them "on-the-fly"
 */
register({
  transpileOnly: true,
})

declare global {
  interface PumpkinsSingletonApp {}
}

let app: PumpkinsSingletonApp

if (isGlobalSingletonEnabled()) {
  pog('creating app singleton')
  app = createApp()
  ;(app as any).installGlobally()
}

export { app }
export { Plugin } from './plugin'
export * from './app'
