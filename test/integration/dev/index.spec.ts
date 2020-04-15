import * as TestContext from '../../../src/lib/test-context'
import { stripIndent } from 'common-tags'
import { rootLogger } from '../../../src/lib/nexus-logger'
import { spawn, createE2EContext } from '../../../src/lib/e2e-testing'
import { writeToFS, MemoryFS } from '../../../src/lib/testing-utils'
import { bufferOutput, takeUntilServerListening } from '../../__helpers/e2e'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { fs } from '../../../src/lib/test-context'
import { createPackageManager, installDeps } from '../../../src/lib/package-manager'
import { takeWhile } from 'rxjs/operators'

/**
 * Disable logger timeDiff and color to allow snapshot matching
 */
rootLogger.settings({
  pretty: {
    enabled: true,
    timeDiff: false,
    color: false,
  },
})

/**
 * Helpers
 */

//  const NEXUS_ROOT = path.join(__dirname, '..', '..', '..')

// const watcherContext = TestContext.create(
//   (opts: TestContext.TmpDirContribution & TestContext.FsContribution) => {
//     return {
//       async setup(vfs: MemoryFS) {
//         const tmpDir = opts.tmpDir()

//         writeToFS(tmpDir, {
//           ...vfs,
//           'package.json': JSON.stringify({
//             name: 'watcher-test',
//             dependencies: {
//               nexus: `file:${NEXUS_ROOT}`
//             }
//           })
//         })

//         await installDeps('npm', { cwd: opts.tmpDir() })
//       },
//       startWatcher() {
//         const cliPath = require.resolve('../../../dist/cli/main')

//         return spawn('node', [cliPath, 'dev'], { cwd: opts.tmpDir() })
//       },
//     }
//   }
// )

const defaultGraphQLContent = stripIndent`
  import { schema } from 'nexus'

  schema.objectType({
    name: 'Test',
    definition(t) {
      t.int('id')
    }
  })
`

// const ctx = TestContext.compose(TestContext.tmpDir, TestContext.fs, watcherContext)

const app = createE2EContext({
  serverPort: 5006,
  localNexus: {
    path: path.join(__dirname, '..', '..', '..'),
    createAppWithThis: true,
    createPluginWithThis: true,
    pluginLinksToThis: true,
  },
})

it('restarts when a file is changed', async () => {
  // const proc = app.localNexusCreateApp!({
  //   databaseType: 'NO_DATABASE',
  //   packageManagerType: 'npm',
  // })
  // const sub = proc.connect()

  // const output = await proc.refCount().pipe(
  //   bufferOutput,
  //   takeWhile((data: string) => !data.includes('server has restarted'))
  // ).

  // app.fs.write('api/app.ts', `console.log('server has restarted')`)

  // sub.unsubscribe()

  // expect(output).toContain('server has restarted')
})
