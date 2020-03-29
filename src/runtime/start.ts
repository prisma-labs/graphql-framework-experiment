import { stripIndent } from 'common-tags'
import { EOL } from 'os'
import { EmitAndSemanticDiagnosticsBuilderProgram } from 'typescript'
import { stripExt } from '../lib/fs'
import * as Layout from '../lib/layout'
import { rootLogger } from '../lib/nexus-logger'
import { transpileModule } from '../lib/tsc'

const log = rootLogger.child('start-module')

export const START_MODULE_NAME = 'index'
export const START_MODULE_HEADER = 'GENERATED NEXUS START MODULE'

type StartModuleConfig = {
  internalStage: 'build' | 'dev'
  layout: Layout.Layout
  disableArtifactGeneration?: boolean
  relativePackageJsonPath?: string
  inlineSchemaModuleImports?: boolean
  pluginNames: string[]
}

export function createStartModuleContent(config: StartModuleConfig): string {
  log.trace('create start module')
  let content = `// ${START_MODULE_HEADER}` + '\n'

  content += EOL + EOL + EOL
  content += stripIndent`
    process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS = '${!config.disableArtifactGeneration}'
  `

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
    const app = require("nexus-future").default
  `

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

  if (config.relativePackageJsonPath) {
    content += EOL + EOL + EOL
    content += stripIndent`
      // package.json is needed for plugin auto-import system.
      // On the Zeit Now platform, builds and dev copy source into
      // new directory. Copying follows paths found in source. Give one here
      // to package.json to make sure Zeit Now brings it along.
      require('${config.relativePackageJsonPath}')
    `
  }

  if (config.pluginNames) {
    content += EOL + EOL + EOL
    content += stripIndent`
    // Statically require all plugins so that tree-shaking can be done
    ${config.pluginNames
      .map(pluginName => `require('nexus-plugin-${pluginName}')`)
      .join('\n')}
    `
  }

  if (config.inlineSchemaModuleImports) {
    // This MUST come after nexus-future package has been imported for its side-effects
    const staticImports = Layout.schema.printStaticImports(config.layout)
    if (staticImports !== '') {
      content += EOL + EOL + EOL
      content += stripIndent`
        // Import the user's schema modules
        ${staticImports}
      `
    }
  }

  if (config.layout.app.exists) {
    content += EOL + EOL + EOL
    content += stripIndent`
      // Import the user's app module
      require("./${stripExt(
        config.layout.sourceRelative(config.layout.app.path)
      )}")
    `
  }

  if (config.pluginNames) {
    const aliasAndPluginNames = config.pluginNames.map(pluginName => {
      const namedImportAlias = `plugin_${Math.random()
        .toString()
        .slice(2, 5)}`
      return [namedImportAlias, pluginName]
    })
    content += EOL + EOL + EOL
    content += stripIndent`
      // Apply runtime plugins
      ${aliasAndPluginNames
        .map(([namedImportAlias, pluginName]) => {
          return `import { plugin as ${namedImportAlias} } from 'nexus-plugin-${pluginName}/dist/runtime'`
        })
        .join(EOL)}

      ${aliasAndPluginNames
        .map(([namedImportAlias, pluginName]) => {
          return `app.__use('${pluginName}', ${namedImportAlias})`
        })
        .join(EOL)}
    `
  }

  content += EOL + EOL + EOL
  content += stripIndent`
    // Boot the server if the user did not already.
    const app__:any = app
    if (app__.__state.isWasServerStartCalled === false) {
      app.server.start()
    }  
  `

  log.trace('created', { content })
  return content
}

export function prepareStartModule(
  tsBuilder: EmitAndSemanticDiagnosticsBuilderProgram,
  startModule: string
): string {
  log.trace('Transpiling start module')
  return transpileModule(startModule, tsBuilder.getCompilerOptions())
}
