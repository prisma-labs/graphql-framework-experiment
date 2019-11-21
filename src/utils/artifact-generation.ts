import { spawnSync } from 'child_process'
import { pog } from './pog'

const log = pog.sub('typegen')

export async function generateArtifacts(bootScript: string): Promise<void> {
  log('starting typegen...')
  const result = spawnSync('npx', ['ts-node', '--eval', bootScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PUMPKINS_STAGE: 'dev',
      PUMPKINS_SHOULD_AWAIT_TYPEGEN: 'true',
      PUMPKINS_SHOULD_GENERATE_ARTIFACTS: 'true',
      PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
  })

  if (result.error) {
    log('...had error trying to start the typegen process')
    throw result.error
  }

  log(
    '...artifact generation run (pid %s) completed with exit code %s',
    result.pid,
    result.status
  )
  log('...captured: stdout:\n  %O', result.stdout)
  log('...captured: stderr:\n  %O', result.stderr)

  if (result.status !== 0) {
    log('...had error while running the typegen process')
    const error = new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)

    throw error
  }
}
