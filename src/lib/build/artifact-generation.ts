import { spawnSync } from 'child_process'
import * as FS from 'fs-jetpack'
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
    throw new Error(
      `Error while trying to start the typegen process:\n\n${result.error}`
    )
  }

  if (result.stderr) {
    throw new Error(
      `Error while trying to start the typegen process:\n\n${result.stderr}`
    )
  }

  if (result.status !== 0) {
    throw new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)
  }

  // Handling no-hoist problem
  // https://github.com/graphql-nexus/nexus-future/issues/432
  // todo link to website docs

  if (process.env.NEXUS_TYPEGEN_NEXUS_SCHEMA_IMPORT_PATH) {
    const importPattern = /"@nexus\/schema"/g
    const indexDTSPath = FS.path(
      `${process.cwd()}`,
      'node_modules',
      '@types',
      'typegen-nexus',
      'index.d.ts'
    )
    log.warn(
      'will override @schema/nexus import path in typegen b/c env var set',
      {
        importPattern,
        indexDTSPath,
        NEXUS_TYPEGEN_NEXUS_SCHEMA_IMPORT_PATH:
          process.env.NEXUS_TYPEGEN_NEXUS_SCHEMA_IMPORT_PATH,
      }
    )
    const indexDTS = await FS.readAsync(indexDTSPath)
    if (!indexDTS) throw new Error(`could not find ${indexDTSPath}`)
    if (!indexDTS.match(importPattern)) {
      throw new Error(
        `@nexus/schema import hack cannot proceed because pattern match failed: ${importPattern}.\n\nFile content was:\n\n${indexDTS}`
      )
    }
    const indexDTSUpdated = indexDTS.replace(
      importPattern,
      `"../../nexus-future/node_modules/@nexus/schema"`
    )
    await FS.writeAsync(indexDTSPath, indexDTSUpdated)
  }

  log.trace('done', result as any)
}
