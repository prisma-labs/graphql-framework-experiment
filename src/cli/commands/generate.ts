import * as Plugin from '../../core/plugin'
import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { Command } from '../../lib/cli'
import { generateArtifacts } from '../../utils'
import { logger } from '../../utils/logger'

export class Generate implements Command {
  async parse() {
    const layout = await Layout.create()
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)

    for (const p of plugins) {
      await p.hooks.generate.onStart?.()
    }

    logger.info('Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        internalStage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    logger.info('done')
  }
}
