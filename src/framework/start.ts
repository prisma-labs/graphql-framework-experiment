import { stripIndent } from 'common-tags'
import { printStaticSchemaImports } from './schema'
import { Layout } from './layout'

type StartModuleConfig = {
  stage: 'build' | 'dev'
  /**
   * Whether or not app content needs to be scaffolded. This is needed when for
   * example the user only supplies a schemta.ts module.
   */
  appPath: null | string
  layout: Layout
}

export function createStartModuleContent(config: StartModuleConfig): string {
  let output = ''

  if (config.stage === 'build') {
    output += stripIndent`
      // Guarantee that development mode features will not accidentally run
      process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'false'

    `
  } else if (config.stage === 'dev') {
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

  if (config.stage === 'build') {
    output += '\n\n\n'
    output += stripIndent`
      // Import the user's schema modules
      // This MUST come after pumpkins package has been imported for its side-effects
      ${printStaticSchemaImports(config.layout)}
    `
  }

  output += '\n\n\n'
  output += config.appPath
    ? stripIndent`
        // import the user's app module
        require("${config.appPath}")
      `
    : // TODO if user has disabled global singleton, then honour that here
      stripIndent`
        // Start the server
        app.server.start()
      `

  return output
}
