import * as ts from 'typescript'
import * as Layout from '../../lib/layout'
import { transpileModule } from '../../lib/tsc'
import type { InternalApp } from '../app'
import * as Server from '../server'
import { createStartModuleContent, StartModuleOptions } from './start-module'

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
  appSingleton: InternalApp,
  opts?: {
    catchUnhandledErrors?: StartModuleOptions['catchUnhandledErrors']
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
    runtimePluginManifests: [],
    catchUnhandledErrors: opts?.catchUnhandledErrors
  })

  const transpiledStartModule = transpileModule(startModule, {
    ...layout.tsConfig.content.options,
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
  })

  return {
    start: () => {
      return eval(transpiledStartModule)
    },
    stop: () => appSingleton.server.stop(),
    port: appSingleton.settings.current.server.port,
  }
}
