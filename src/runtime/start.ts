import { stripIndent } from 'common-tags'
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

  content += '\n\n\n'
  content += stripIndent`
    process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS = '${!config.disableArtifactGeneration}'
  `

  if (config.internalStage === 'dev') {
    content += '\n\n\n'
    content += stripIndent`
      process.env.NEXUS_STAGE = 'dev'
    `
  }

  content += '\n\n\n'
  content += stripIndent`
    // Run framework initialization side-effects
    // Also, import the app for later use
    const app = require("nexus-future").default
  `

  if (config.relativePackageJsonPath) {
    content += '\n\n\n'
    content += stripIndent`
      // package.json is needed for plugin auto-import system.
      // On the Zeit Now platform, builds and dev copy source into
      // new directory. Copying follows paths found in source. Give one here
      // to package.json to make sure Zeit Now brings it along.
      require('${config.relativePackageJsonPath}')
    `
  }

  if (config.inlineSchemaModuleImports) {
    // This MUST come after nexus-future package has been imported for its side-effects
    const staticImports = Layout.schema.printStaticImports(config.layout)
    if (staticImports !== '') {
      content += '\n\n\n'
      content += stripIndent`
        // Import the user's schema modules
        ${staticImports}
      `
    }
  }

  if (config.layout.app.exists) {
    content += '\n\n\n'
    content += stripIndent`
      // import the user's app module
      require("./${stripExt(
        config.layout.sourceRelative(config.layout.app.pathAbs)
      )}")
    `
  }

  if (config.pluginNames) {
    content += '\n\n\n'
    content += stripIndent`
      // Apply runtime plugins
      const plugins = [${config.pluginNames
        .map(
          pluginName =>
            `["${pluginName}", require('nexus-plugin-${pluginName}/dist/runtime').default]`
        )
        .join(', ')}]
      plugins.forEach(function (plugin) {
        app.__use(plugin[0], plugin[1])
      })
    `
  }

  content += '\n\n\n'
  content += stripIndent`
    // Boot the server if the user did not already.
    if ((app: any).__state.isWasServerStartCalled === false) {
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
