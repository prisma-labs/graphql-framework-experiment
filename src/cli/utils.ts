import { stripIndents, stripIndent } from 'common-tags'

type BootModuleConfig = {
  sourceEntrypoint?: string
  stage: 'build' | 'dev'
  /**
   * Whether or not app content needs to be scaffolded. This is needed when for
   * example the user only supplies a schemta.ts module.
   */
  app: boolean
}

export const createBootModuleContent = (config: BootModuleConfig): string => {
  // TODO we do not need to import the user's code when they give just a schema
  return config.stage === 'build'
    ? stripIndents`
        // Guarantee that development mode features will not accidentally run
        process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'false'

        // Guarantee the side-effect features like singleton global do run
        require("pumpkins")

        ${
          config.sourceEntrypoint
            ? stripIndents`
                // import the user's code
                require("${config.sourceEntrypoint}")
              `
            : ''
        }
        ${
          config.app
            ? stripIndents`
                // Boot the server
                app.server.start()
              `
            : ''
        }
      `
    : stripIndents`
        // Guarantee that development mode features are on
        process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'true'

        // Guarantee the side-effect features like singleton global do run
        import "pumpkins"

        ${
          config.sourceEntrypoint
            ? stripIndents`
                // import the user's code
                import "${config.sourceEntrypoint}"
              `
            : ''
        }
        ${
          config.app
            ? stripIndents`
                // Boot the server
                app.server.start()
              `
            : ''
        }

      `
}
