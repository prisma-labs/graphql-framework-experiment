import { spawnSync } from 'child_process'
import { rootLogger } from './logger'

const log = rootLogger.child('typegen')

export async function generateArtifacts(startScript: string): Promise<void> {
  log.trace('start')
  const result = spawnSync('npx', ['ts-node', '--eval', startScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXUS_STAGE: 'dev',
      NEXUS_SHOULD_AWAIT_TYPEGEN: 'true',
      NEXUS_SHOULD_GENERATE_ARTIFACTS: 'true',
      NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
  })

  if (result.error) {
    log.trace('...had error trying to start the typegen process')
    throw result.error
  }

  log.trace('done', result as any)

  if (result.status !== 0) {
    log.trace('...had error while running the typegen process')
    const error = new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)

    throw error
  }
}
