import * as ts from 'typescript'
import * as Layout from '../../lib/layout'
import { transpileModule } from '../../lib/tsc'
import * as Server from '../server'
import { createStartModuleContent } from './start-module'

export function createDevAppRunner(
  layout: Layout.Layout,
  pluginNames: string[],
  opts?: {
    server?: Server.ExtraSettingsInput
  }
): {
  start: () => Promise<void>
  stop: () => Promise<void>
  port: number
} {
  const startModule = createStartModuleContent({
    internalStage: 'dev',
    layout,
    absoluteSchemaModuleImports: true,
    pluginNames,
  })
  const transpiledStartModule = transpileModule(startModule, {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
  })

  // Dynamically require app here to prevent from constructing the singleton when importing this module
  const app = require('../../index')

  app.settings.change({
    server: {
      ...opts?.server,
    },
  })

  return {
    start: () => eval(transpiledStartModule),
    stop: () => app.server.stop(),
    port: app.settings.current.server.port,
  }
}
