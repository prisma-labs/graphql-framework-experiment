import { stripIndent } from 'common-tags'
import { EmitAndSemanticDiagnosticsBuilderProgram } from 'typescript'
import { stripExt } from '../lib/fs'
import * as Layout from '../lib/layout'
import { rootLogger } from '../lib/nexus-logger'
import { transpileModule } from '../lib/tsc'

export const START_MODULE_NAME = 'index'
export const START_MODULE_HEADER = 'GENERATED NEXUS START MODULE'

const log = rootLogger.child('start-module')

type StartModuleConfig = {
  internalStage: 'build' | 'dev'
  layout: Layout.Layout
  disableArtifactGeneration?: boolean
  relativePackageJsonPath?: string
  inlineSchemaModuleImports?: boolean
  pluginNames?: string[]
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

  // todo test coverage for this feature
  content += '\n\n\n'
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
    content += '\n\n'
    content += stripIndent`
      // package.json is needed for plugin auto-import system.
      // On the Zeit Now platform, builds and dev copy source into
      // new directory. Copying follows paths found in source. Give one here
      // to package.json to make sure Zeit Now brings it along.
      require('${config.relativePackageJsonPath}')
    `
  }

  if (config.pluginNames) {
    content += '\n\n'
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
      content += '\n\n\n'
      content += stripIndent`
        // Import the user's schema modules
        ${staticImports}
      `
    }
  }

  // TODO Despite the comment below there are still sometimes reasons to do so
  // https://github.com/graphql-nexus/nexus-future/issues/141
  content += '\n\n\n'
  content += config.layout.app.exists
    ? stripIndent`
        // Import the user's app module
        require("./${stripExt(
          config.layout.sourceRelative(config.layout.app.path)
        )}")

        // Boot the server for the user if they did not alreay do so manually.
        // Users should normally not boot the server manually as doing so does not
        // bring value to the user's codebase.

        const singletonChecks = require('nexus-future/dist/runtime/singleton-checks')

        if (singletonChecks.state.is_was_server_start_called === false) {
          app.server.start()
        }
        `
    : stripIndent`
        // Start the server
        app.server.start()
      `

  return content
}

export function prepareStartModule(
  tsBuilder: EmitAndSemanticDiagnosticsBuilderProgram,
  startModule: string
): string {
  log.trace('Transpiling start module')
  return transpileModule(startModule, tsBuilder.getCompilerOptions())
}
