import { generateArtifacts } from '../../lib/artifact-generation'
import { Command } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { log } from '../../lib/nexus-logger'
import * as Plugin from '../../lib/plugin'
import { createStartModuleContent } from '../../runtime/start'

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
