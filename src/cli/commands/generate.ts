import { generateArtifacts } from '../../utils'
import { runPrismaGenerators } from '../../framework/plugins'
import { createStartModuleContent } from '../../framework/start'
import * as Layout from '../../framework/layout'
import { Command } from '../helpers'
import { loadPlugins } from '../helpers/utils'

export class Generate implements Command {
  async parse() {
    const plugins = await loadPlugins()

    for (const p of plugins) {
      await p.onGenerateStart?.()
    }

    const layout = await Layout.create()

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
