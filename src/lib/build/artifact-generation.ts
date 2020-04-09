import { spawnSync } from 'child_process'
import { Layout } from '../layout'
import { rootLogger } from '../nexus-logger'

const log = rootLogger.child('typegen')

export async function generateArtifacts(layout: Layout): Promise<void> {
  log.trace('start')

  const result = spawnSync('node', [layout.startModuleOutPath], {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: layout.projectRoot,
    env: {
      ...process.env,
      NEXUS_SHOULD_AWAIT_TYPEGEN: 'true',
      NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
    },
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
