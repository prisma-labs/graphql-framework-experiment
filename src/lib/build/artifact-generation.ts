import { spawnSync } from 'child_process'
import { ts } from 'ts-morph'
import { createStartModuleContent } from '../../runtime/start'
import { Layout } from '../layout'
import { rootLogger } from '../nexus-logger'
import { transpileModule } from '../tsc'

const log = rootLogger.child('typegen')

export async function generateArtifacts(layout: Layout): Promise<void> {
  log.trace('start')

  const startModule = createStartModuleContent({
    registerTypeScript: {
      ...layout.tsConfig.content.options,
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
    },
    internalStage: 'build',
    absoluteModuleImports: true,
    layout: layout,
    runtimePluginManifests: [], // No need to statically require runtime plugins in dev (no need to tree-shake)
  })

  const transpiledStartModule = transpileModule(startModule, {
    ...layout.tsConfig.content.options,
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
  })

  const result = spawnSync('node', ['--eval', transpiledStartModule], {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: layout.projectRoot,
  })

  if (result.error) {
    throw new Error(`Error while trying to start the typegen process:\n\n${result.error}`)
  }

  if (result.stderr) {
    throw new Error(`Error while trying to start the typegen process:\n\n${result.stderr}`)
  }

  if (result.status !== 0) {
    throw new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)
  }

  log.trace('done', result as any)
}
