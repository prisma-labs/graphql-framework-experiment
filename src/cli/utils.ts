import {
  pumpkinsPath,
  findServerEntryPoint,
  log,
  cachedWriteFile,
} from '../utils'
import { stripIndent, stripIndents } from 'common-tags'

type BootModuleConfig = {
  path: string
  appEntrypointPath: string
  stage: 'build' | 'dev'
}

export const setupBootModule = (config: BootModuleConfig): void => {
  // TODO async
  log('setting up boot module %s', config.path)

  cachedWriteFile(
    config.path,
    stripIndents`
        ${
          config.stage === 'build'
            ? stripIndent`
                // Guarantee that development mode features will not accidentally run
                process.env.PUMPKINS_SHOULD_GENERATE_ARTIFACTS = "false"
              `
            : ''
        }

        // Guarantee the side-effect features like singleton global do run
        ${
          config.stage === 'build' ? `require("pumpkins")` : `import "pumpkins"`
        }

        // Run the user's code
        ${
          config.stage === 'build'
            ? `require("${config.appEntrypointPath}")`
            : `import "${config.appEntrypointPath}"`
        }
        
      `
  )
}
