import { spawnSync } from 'child_process'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { findServerEntryPoint } from './path'
import { log } from './log'

export async function generateArtifacts(
  entrypoint?: string
): Promise<{ entrypoint: string; error?: Error }> {
  const entryPoint = entrypoint ? fs.path(entrypoint) : findServerEntryPoint()

  if (!(await fs.existsAsync(entryPoint))) {
    throw new Error(
      `🎃  Entry point "${path.relative(
        process.cwd(),
        entryPoint
      )}" does not exist`
    )
  }

  const result = spawnSync('npx', ['ts-node', entryPoint], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PUMPKINS_SHOULD_AWAIT_TYPEGEN: 'true',
      PUMPKINS_SHOULD_GENERATE_ARTIFACTS: 'true',
      PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
  })

  log('artifact generation result: %O', result)

  if (result.error) {
    return {
      error: result.error,
      entrypoint: entryPoint,
    }
  }

  if (result.status !== 0) {
    const error = new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)

    return {
      error,
      entrypoint: entryPoint,
    }
  }

  return {
    entrypoint: entryPoint,
  }
}
