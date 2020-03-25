import { stripIndent } from 'common-tags'
import * as Layout from '../lib/layout'

export const START_MODULE_NAME = 'index'
export const START_MODULE_HEADER = 'GENERATED NEXUS START MODULE'

type StartModuleConfig =
  | {
      internalStage: 'dev'
      /**
       * Whether or not app content needs to be scaffolded. This is needed when for
       * example the user only supplies a schemta.ts module.
       */
      appPath: null | string
      layout: Layout.Layout
      pluginNames: string[]
    }
  | {
      internalStage: 'build'
      /**
       * Whether or not app content needs to be scaffolded. This is needed when for
       * example the user only supplies a schemta.ts module.
       */
      appPath: null | string
      layout: Layout.Layout
      buildStage: string
      relativePackageJsonPath?: string
      pluginNames: string[]
    }

export function createStartModuleContent(config: StartModuleConfig): string {
  let output = `// ${START_MODULE_HEADER}` + '\n'

  if (config.internalStage === 'build') {
    output += stripIndent`
      // Guarantee that development mode features will not accidentally run
      process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS = 'false'

    `
  } else if (config.internalStage === 'dev') {
    output += stripIndent`
      // Guarantee that development mode features are on
      process.env.NEXUS_SHOULD_GENERATE_ARTIFACTS = 'true'
      process.env.NEXUS_STAGE = 'dev'
    `
  }

  output += '\n\n\n'
  output += stripIndent`
    // Guarantee the side-effect features like singleton global do run
    require("nexus-future")
  `

  if (config.internalStage === 'build' && config.relativePackageJsonPath) {
    output += '\n\n'
    output += stripIndent`
      // Hack to enable package.json to be imported by various deployment services such as now.sh
      require('${config.relativePackageJsonPath}')
    `
  }

  output += '\n\n'
  output += stripIndent`
    // Apply runtime plugins
    const plugins = [${config.pluginNames
      .map(pluginName => `require('nexus-plugin-${pluginName}')`)
      .join(', ')}]
    plugins.forEach(function (plugin) {
      app.__use(pluginName, plugin)
    })
    
  `

  if (config.internalStage === 'build') {
    const staticImports = Layout.schema.printStaticImports(config.layout)
    if (staticImports !== '') {
      output += '\n\n\n'
      output += stripIndent`
        // Import the user's schema modules
        // This MUST come after nexus-future package has been imported for its side-effects
        ${staticImports}
      `
    }
  }

  // TODO Despite the comment below there are still sometimes reasons to do so
  // https://github.com/graphql-nexus/nexus-future/issues/141
  output += '\n\n\n'
  output += config.appPath
    ? stripIndent`
        // import the user's app module
        require("${
          config.internalStage === 'build'
            ? Layout.relativeTranspiledImportPath(
                config.layout,
                config.appPath!
              )
            : config.appPath
        }")

        // Boot the server for the user if they did not alreay do so manually.
        // Users should normally not boot the server manually as doing so does not
        // bring value to the user's codebase.

        const app = require('nexus-future')
        const singletonChecks = require('nexus-future/dist/runtime/singleton-checks')

        if (singletonChecks.state.is_was_server_start_called === false) {
          app.server.start()
        }
        `
    : stripIndent`
        // Start the server
        const app = require('nexus-future')
        app.server.start()
      `

  return output
}
