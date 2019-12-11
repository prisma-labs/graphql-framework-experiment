import { generateArtifacts } from '../../utils'
import { createStartModuleContent } from '../../framework/start'
import * as Layout from '../../framework/layout'
import { Command } from '../helpers'
import * as Plugin from '../../framework/plugin'

export class Generate implements Command {
  async parse() {
    const layout = await Layout.create()
    const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(layout)

    for (const p of plugins) {
      await p.generate.onStart?.()
    }

    console.log('🎃  Generating Nexus artifacts ...')
    await generateArtifacts(
      createStartModuleContent({
        stage: 'dev',
        appPath: layout.app.path,
        layout,
      })
    )
    console.log('🎃  Successfully generated the artifacts')
  }
}
