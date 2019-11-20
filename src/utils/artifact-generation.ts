import { spawnSync } from 'child_process'
import { pog } from './pog'

export async function generateArtifacts(bootScript: string): Promise<void> {
  const result = spawnSync('npx', ['ts-node', '--eval', bootScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PUMPKINS_SHOULD_AWAIT_TYPEGEN: 'true',
      PUMPKINS_SHOULD_GENERATE_ARTIFACTS: 'true',
      PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
  })

  pog('artifact generation run result: %O', result)

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const error = new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)

    throw error
  }
}
