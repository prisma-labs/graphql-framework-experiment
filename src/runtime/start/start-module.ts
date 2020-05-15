import { stripIndent } from 'common-tags'
import { EOL } from 'os'
import * as Path from 'path'
import ts, { EmitAndSemanticDiagnosticsBuilderProgram } from 'typescript'
import { stripExt } from '../../lib/fs'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import * as Plugin from '../../lib/plugin'
import { transpileModule } from '../../lib/tsc'
import { resolveFrom } from './resolve-from'

const log = rootLogger.child('start-module')

export const START_MODULE_NAME = 'index'
export const START_MODULE_HEADER = 'GENERATED NEXUS START MODULE'

export type StartModuleConfig = {
  internalStage: 'build' | 'dev'
  layout: Layout.Layout
  /**
   * The plugins the app is using. The start module imports them so that tree shakers
   * can be run over the final build, pulling in the sources of the respective plugins.
   */
  runtimePluginManifests: Plugin.Manifest[]
} & StartModuleOptions

export type StartModuleOptions = {
  /**
   * Configure start module to require all files with absolute paths
   *
   * @default false
   */
  absoluteModuleImports?: boolean
  /**
   * Configure start module to register Typescript as a NodeJS extensions
   *
   * @default false
   */
  registerTypeScript?: boolean | ts.CompilerOptions
  /**
   * Configure start module to catch unhandled errors
   *
   * @default true
   */
  catchUnhandledErrors?: boolean
}

export function createStartModuleContent(config: StartModuleConfig): string {
  let content = `// ${START_MODULE_HEADER}`

  if (config.registerTypeScript) {
    content += EOL + EOL + EOL
    content += stripIndent`
      import { registerTypeScriptTranspile } from '${
        config.absoluteModuleImports
          ? Path.dirname(resolveFrom('nexus', config.layout.projectRoot))
          : 'nexus/dist'
      }/lib/tsc'
      registerTypeScriptTranspile(${
        typeof config.registerTypeScript === 'object' ? JSON.stringify(config.registerTypeScript) : '{}'
      })
    `
  }

  if (config.internalStage === 'dev') {
    content += EOL + EOL + EOL
    content += stripIndent`
      process.env.NEXUS_STAGE = 'dev'
    `
  }

  content += EOL + EOL + EOL
  content += stripIndent`
    // Run framework initialization side-effects
    // Also, import the app for later use
    import app from "${
      config.absoluteModuleImports ? resolveFrom('nexus', config.layout.projectRoot) : 'nexus'
    }")
  `

  if (config.catchUnhandledErrors !== false) {
    // todo test coverage for this feature
    content += EOL + EOL + EOL
    content += stripIndent`
    // Last resort error handling
    process.once('uncaughtException', error => {
      app.log.fatal('uncaughtException', { error: error })
      process.exit(1)
    })

    process.once('unhandledRejection', error => {
      app.log.fatal('unhandledRejection', { error: error })
      process.exit(1)
    })
  `
  }

  if (config.layout.packageJson) {
    content += EOL + EOL + EOL
    content += stripIndent`
      // package.json is needed for plugin auto-import system.
      // On the Zeit Now platform, builds and dev copy source into
      // new directory. Copying follows paths found in source. Give one here
      // to package.json to make sure Zeit Now brings it along.
      require('${
        config.absoluteModuleImports
          ? config.layout.packageJson.path
          : Path.relative(config.layout.build.outputDir, config.layout.packageJson.path)
      }')
    `
  }

  // This MUST come after nexus package has been imported for its side-effects
  const staticImports = printStaticImports(config.layout, {
    absolutePaths: config.absoluteModuleImports,
  })
  if (staticImports !== '') {
    content += EOL + EOL + EOL
    content += stripIndent`
        // Import the user's schema modules
        ${staticImports}
      `
  }

  if (config.layout.app.exists) {
    content += EOL + EOL + EOL
    content += stripIndent`
      // Import the user's app module
      require("${
        config.absoluteModuleImports
          ? stripExt(config.layout.app.path)
          : './' + stripExt(config.layout.sourceRelative(config.layout.app.path))
      }")
    `
  }

  if (config.runtimePluginManifests.length) {
    content += EOL + EOL + EOL
    content += stripIndent`
      ${config.runtimePluginManifests
        .map((plugin, i) => {
          return `import { ${plugin.runtime!.export} as plugin_${i} } from '${
            config.absoluteModuleImports
              ? plugin.runtime!.module
              : relativeModuleImport(plugin.name, plugin.runtime!.module)
          }'`
        })
        .join(EOL)}
    `
  }

  content += EOL + EOL + EOL
  content += stripIndent`
    app.assemble()
    app.start()
  `

  log.trace('created start module', { content })
  return content
}

export function prepareStartModule(
  tsBuilder: EmitAndSemanticDiagnosticsBuilderProgram,
  startModule: string
): string {
  log.trace('Transpiling start module')
  return transpileModule(startModule, tsBuilder.getCompilerOptions())
}

/**
 * Build up static import code for all schema modules in the project. The static
 * imports are relative so that they can be calculated based on source layout
 * but used in build layout.
 *
 * Note that it is assumed the module these imports will run in will be located
 * in the source/build root.
 */
export function printStaticImports(layout: Layout.Layout, opts?: { absolutePaths?: boolean }): string {
  return layout.schemaModules.reduce((script, modulePath) => {
    const path = opts?.absolutePaths ? stripExt(modulePath) : relativeTranspiledImportPath(layout, modulePath)
    return `${script}\n${printSideEffectsImport(path)}`
  }, '')
}

function printSideEffectsImport(modulePath: string): string {
  return `import '${modulePath}'`
}

/**
 * Build up what the import path will be for a module in its transpiled context.
 */
export function relativeTranspiledImportPath(layout: Layout.Layout, modulePath: string): string {
  return './' + stripExt(calcSourceRootToModule(layout, modulePath))
}

function calcSourceRootToModule(layout: Layout.Layout, modulePath: string) {
  return Path.relative(layout.sourceRoot, modulePath)
}

function relativeModuleImport(moduleName: string, absoluteModuleImport: string) {
  const moduleNamePos = absoluteModuleImport.lastIndexOf(moduleName)
  const relativeModuleImport = absoluteModuleImport.substring(moduleNamePos)

  return stripExt(relativeModuleImport)
}
