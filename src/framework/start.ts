import { stripIndent } from 'common-tags'
import { printStaticSchemaImports } from './schema'
import { Layout, relativeTranspiledImportPath } from './layout'
import { Config, printStaticEnvSetters } from './config'

type StartModuleConfig =
  | {
      internalStage: 'dev'
      /**
       * Whether or not app content needs to be scaffolded. This is needed when for
       * example the user only supplies a schemta.ts module.
       */
      appPath: null | string
      layout: Layout
    }
  | {
      internalStage: 'build'
      /**
       * Whether or not app content needs to be scaffolded. This is needed when for
       * example the user only supplies a schemta.ts module.
       */
      appPath: null | string
      layout: Layout
      config: Config | null
      buildStage: string
    }

export function createStartModuleContent(config: StartModuleConfig): string {
  let output = ''

  if (config.internalStage === 'build') {
    output += stripIndent`
      // Guarantee that development mode features will not accidentally run
      process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'false'

    `
  } else if (config.internalStage === 'dev') {
    output += stripIndent`
      // Guarantee that development mode features are on
      process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'true'
      process.env.PUMPKINS_STAGE = 'dev'
    `
  }

  output += '\n\n\n'
  output += stripIndent`
    // Guarantee the side-effect features like singleton global do run
    require("pumpkins")
  `

  if (config.internalStage === 'build') {
    const staticImports = printStaticSchemaImports(config.layout)
    if (staticImports !== '') {
      output += '\n\n\n'
      output += stripIndent`
        // Import the user's schema modules
        // This MUST come after pumpkins package has been imported for its side-effects
        ${staticImports}
      `
    }
  }

  if (config.internalStage === 'build' && config.config !== null) {
    const staticEnvSetters = printStaticEnvSetters(
      config.config,
      config.buildStage
    )

    if (staticEnvSetters !== '') {
      output += '\n\n\n'
      output += stripIndent`
          // Define the environments variables based on pumpkins.config.ts file or build -d flag
          ${staticEnvSetters}
        `
    }
  }

  // TODO Despite the comment below there are still sometimes reasons to do so
  // https://github.com/prisma/pumpkins/issues/141
  output += '\n\n\n'
  output += config.appPath
    ? stripIndent`
        // import the user's app module
        require("${
          config.internalStage === 'build'
            ? relativeTranspiledImportPath(config.layout, config.appPath!)
            : config.appPath
        }")

        // Boot the server for the user if they did not alreay do so manually.
        // Users should normally not boot the server manually as doing so does not
        // bring value to the user's codebase.

        const { app } = require('pumpkins')
        const singletonChecks = require('pumpkins/dist/framework/singleton-checks')

        if (singletonChecks.state.is_was_server_start_called === false) {
          app.server.start()
        }
        `
    : stripIndent`
        // Start the server
        const { app } = require('pumpkins')
        app.server.start()
      `

  return output
}
