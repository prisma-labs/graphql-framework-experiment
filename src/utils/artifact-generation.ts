import { spawnSync } from 'child_process'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { findServerEntryPoint } from './path'

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

  const result = spawnSync('ts-node', [entryPoint], {
    env: {
      ...process.env,
      PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
  })

  return {
    error: result.error,
    entrypoint: entryPoint,
  }
}
