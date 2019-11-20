import { stripIndents } from 'common-tags'

type BootModuleConfig = {
  stage: 'build' | 'dev'
  /**
   * Whether or not app content needs to be scaffolded. This is needed when for
   * example the user only supplies a schemta.ts module.
   */
  appPath: null | string
}

export function createBootModuleContent(config: BootModuleConfig): string {
  let output = ''

  output +=
    config.stage === 'build'
      ? stripIndents`
    // Guarantee that development mode features will not accidentally run
    process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'false'`
      : stripIndents`
    // Guarantee that development mode features are on
    process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'true'`

  output += stripIndents`
    // Guarantee the side-effect features like singleton global do run
    require("pumpkins")
  `

  output += config.appPath
    ? stripIndents`
        // import the user's app module
        require("${config.appPath}")
      `
    : // TODO if user has disabled global singleton, then honour that here
      stripIndents`
        // Boot the server
        app.server.start()
      `

  return output
}
