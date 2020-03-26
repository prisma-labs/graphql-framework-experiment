import { spawnSync } from 'child_process'
import * as FS from 'fs-jetpack'
import { Layout } from '../layout'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { getProjectRoot } from '../project-root'

const log = rootLogger.child('typegen')

export async function generateArtifacts(layout: Layout): Promise<void> {
  log.trace('start')

  const result = spawnSync('node', [layout.startModuleOutAbsPath], {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: getProjectRoot(),
    env: {
      ...process.env,
      NEXUS_SHOULD_AWAIT_TYPEGEN: 'true',
      NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
    },
  })

  // if (areWorkerThreadsAvailable()) {
  //   // avoid import error in node 10.x
  //   const { Worker } = require('worker_threads')
  //   const worker: Worker = new Worker(
  //     Path.join(__dirname, './typegen-worker.js'),
  //     {
  //       workerData: {
  //         startModule: startModule,
  //         // layout: layout.data,
  //       },
  //     } as WorkerOptions
  //   )

  //   await new Promise((res, rej) => {
  //     worker.once('error', error => {
  //       rej(error)
  //     })
  //     worker.once('exit', exitCode => {
  //       if (exitCode !== 0) {
  //         rej()
  //       } else {
  //         res()
  //       }
  //     })
  //   })
  // }
  // const result = spawnSync(
  //   Path.join(, 'node_modules/.bin/ts-node'),
  //   ['--eval', startScript],
  //   {
  //     encoding: 'utf8',
  //     env: {
  //       ...process.env,
  //       NEXUS_SHOULD_AWAIT_TYPEGEN: 'true',
  //       NEXUS_SHOULD_GENERATE_ARTIFACTS: 'true',
  //       NEXUS_SHOULD_EXIT_AFTER_GENERATE_ARTIFACTS: 'true',
  //       TS_NODE_TRANSPILE_ONLY: 'true',
  //     },
  //   }
  // )

  if (result.error) {
    log.trace('There was an error while trying to start the typegen process')
    throw result.error
  }

  if (result.stderr) {
    log.trace('There was an error while trying to start the typegen process')
    fatal(result.stderr)
  }

  if (result.status !== 0) {
    log.trace('There was an error while running the typegen process')
    const error = new Error(`
      Nexus artifact generation failed with exit code "${result.status}". The following stderr was captured:

          ${result.stderr}
    `)

    throw error
    // todo fatal??
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
