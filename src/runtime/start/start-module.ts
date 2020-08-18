import { stripIndent } from 'common-tags'
import { EOL } from 'os'
import * as Path from 'path'
import slash from 'slash'
import * as TSM from 'ts-morph'
import ts from 'typescript'
import { stripExt } from '../../lib/fs'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import * as Plugin from '../../lib/plugin'
import { transpileModule } from '../../lib/tsc'
import { requireResolveFrom } from '../../lib/utils'

const log = rootLogger.child('startModule')

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
          ? Path.dirname(requireResolveFrom('nexus', config.layout.projectRoot))
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
      config.absoluteModuleImports ? requireResolveFrom('nexus', config.layout.projectRoot) : 'nexus'
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

  // This MUST come after nexus package has been imported for its side-effects
  const staticImports = printStaticImports(config.layout, {
    absolutePaths: config.absoluteModuleImports,
  })
  if (staticImports !== '') {
    content += EOL + EOL + EOL
    content += stripIndent`
        // Import the user's Nexus modules
        ${staticImports}
      `
  }

  if (config.layout.app.exists) {
    content += EOL + EOL + EOL
    content += stripIndent`
      // Import the user's app module
      require("${
        config.absoluteModuleImports
          ? importId(config.layout.app.path)
          : relativeImportId(config.layout.sourceRelative(config.layout.app.path))
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
              ? importId(plugin.runtime!.module)
              : absolutePathToPackageImportId(plugin.name, plugin.runtime!.module)
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

export function prepareStartModule(tsProject: TSM.Project, startModule: string): string {
  log.trace('Transpiling start module')
  return transpileModule(startModule, tsProject.getCompilerOptions())
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
  return layout.nexusModules.reduce((script, modulePath) => {
    const path = opts?.absolutePaths
      ? importId(modulePath)
      : relativeImportId(layout.sourceRelative(modulePath))
    return `${script}\n${printSideEffectsImport(path)}`
  }, '')
}

/**
 * Format given path to be a valid module id. Extensions are stripped. Posix path separators used.
 */
function importId(filePath: string): string {
  return slash(stripExt(filePath))
}

/**
 * Format given path to be a valid relative module id. Extensions are stripped. Explicit "./" is added. posix path separators used.
 */
function relativeImportId(filePath: string): string {
  return importId(filePath.startsWith('./') ? filePath : './' + filePath)
}

/**
 * Given an absolute path to a module within a package find the import id for it.
 *
 * The given package name is found within absolute path and considered the start of the import id.
 */
function absolutePathToPackageImportId(packageName: string, absoluteFilePath: string) {
  // todo throw error if packageName not found in absoluteFilePath
  const moduleNamePos = absoluteFilePath.lastIndexOf(packageName)
  const relativeModuleImport = absoluteFilePath.substring(moduleNamePos)

  return importId(relativeModuleImport)
}

/**
 * Print a package import statement but do not important any members from it.
 */
function printSideEffectsImport(modulePath: string): string {
  return `import '${modulePath}'`
}
