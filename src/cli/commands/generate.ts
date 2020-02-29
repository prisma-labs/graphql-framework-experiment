import * as Layout from '../../framework/layout'
import { createStartModuleContent } from '../../framework/start'
import { Command } from '../../lib/cli'
import * as Plugin from '../../lib/plugin'
import { generateArtifacts } from '../../utils'
import { log } from '../../utils/logger'

export class Generate implements Command {
  async parse() {
    const layout = await Layout.create()
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)

    for (const p of plugins) {
      await p.hooks.generate.onStart?.()
    }

    log.info('Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        internalStage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )

    log.info('done')
  }
}
