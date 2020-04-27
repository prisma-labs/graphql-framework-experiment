import * as ts from 'typescript'
import * as Layout from '../../lib/layout'
import { transpileModule } from '../../lib/tsc'
import * as Server from '../server'
import { createStartModuleContent } from './start-module'

export interface DevRunner {
  /**
   * Start the application. Will throw an error if the eval'd code throws
   */
  start: () => Promise<void>
  /**
   * Stop the application
   */
  stop: () => Promise<void>
  /**
   * Port on which the application was run
   */
  port: number
}

export function createDevAppRunner(
  layout: Layout.Layout,
  opts?: {
    server?: Server.SettingsInput
    disableServer?: boolean
  }
): DevRunner {
  const startModule = createStartModuleContent({
    registerTypeScript: {
      ...layout.tsConfig.content.options,
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
    },
    internalStage: 'dev',
    layout: layout,
    absoluteModuleImports: true,
    runtimePluginManifests: [], // No need to statically require runtime plugins in dev (no need to tree-shake)
    disableServer: opts?.disableServer,
  })

  const transpiledStartModule = transpileModule(startModule, {
    ...layout.tsConfig.content.options,
    target: ts.ScriptTarget.ES2015,
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
