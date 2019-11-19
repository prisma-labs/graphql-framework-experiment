import { stripIndents } from 'common-tags'

type BootModuleConfig = {
  appEntrypointPath: string
  stage: 'build' | 'dev'
}

export const createBootModuleContent = (config: BootModuleConfig): string => {
  return config.stage === 'build'
    ? stripIndents`
        // Guarantee that development mode features will not accidentally run
        process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'false'

        // Guarantee the side-effect features like singleton global do run
        require("pumpkins")

        // Run the user's code
        require("${config.appEntrypointPath}")
      `
    : stripIndents`
        // Guarantee that development mode features are on
        process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = 'true'

        // Guarantee the side-effect features like singleton global do run
        import "pumpkins"

        // Run the user's code
        import "${config.appEntrypointPath}"
      `
}
