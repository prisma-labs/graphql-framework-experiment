import * as ts from 'typescript'
import * as Layout from '../../lib/layout'
import { transpileModule } from '../../lib/tsc'
import * as Server from '../server'
import { createStartModuleContent } from './start-module'
import * as Plugin from '../../lib/plugin'

export function createDevAppRunner(
  layout: Layout.Layout,
  plugins: Plugin.Manifest[],
  opts?: {
    server?: Server.ExtraSettingsInput
    disableServer?: boolean
  }
): {
  start: () => Promise<void>
  stop: () => Promise<void>
  port: number
} {
  const startModule = createStartModuleContent({
    internalStage: 'dev',
    layout,
    absoluteModuleImports: true,
    plugins,
    disableServer: opts?.disableServer,
  })
  const transpiledStartModule = transpileModule(startModule, {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
  })

  // Dynamically require app here to prevent from constructing the singleton when importing this module
  const app = require('../../index')

  app.settings.change({
    server: opts?.server,
  })

  return {
    start: () => {
      return eval(transpiledStartModule)
    },
    stop: () => app.server.stop(),
    port: app.settings.current.server.port,
  }
}
