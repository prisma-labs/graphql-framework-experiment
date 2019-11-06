import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { findServerEntryPoint } from './path'

export function generateArtifacts(
  entrypoint?: string
): { entrypoint: string; error?: Error } {
  const entryPoint = entrypoint
    ? path.join(process.cwd(), entrypoint)
    : findServerEntryPoint()

  if (!fs.existsSync(entryPoint)) {
    throw new Error(
      `🎃  Entry point "${path.relative(
        process.cwd(),
        entryPoint
      )}" does not exist`
    )
  }

  try {
    spawnSync('ts-node', [entryPoint, '--transpile-only'], {
      env: {
        ...process.env,
        PUMPKINS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
      },
    })
    return { entrypoint: entryPoint }
  } catch (e) {
    return { error: e, entrypoint: entryPoint }
  }
}
