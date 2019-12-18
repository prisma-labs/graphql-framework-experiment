import * as Config from '../../framework/config'
import * as Layout from '../../framework/layout'
import * as Plugin from '../../framework/plugin'
import { createStartModuleContent } from '../../framework/start'
import { generateArtifacts, logger } from '../../utils'
import { Command } from '../helpers'

export class Generate implements Command {
  async parse() {
    const config = Config.loadAndProcessConfig('development') ?? {}
    const layout = await Layout.create()
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(
      layout,
      config
    )

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

    logger.successBold('Success!')
  }
}
