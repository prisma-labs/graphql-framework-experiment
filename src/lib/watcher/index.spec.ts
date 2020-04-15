import * as path from 'path'
import { createWatcher } from '../../../dist/lib/watcher'
import * as ExitSystem from '../exit-system'
import { rootLogger } from '../nexus-logger'
import * as TestContext from '../test-context'
import { MemoryFS, writeToFS } from '../testing-utils'
import { Event } from './types'

process.env.DEBUG = 'true'

/**
 * Disable logger timeDiff and color to allow snapshot matching
 */
rootLogger.settings({
  pretty: {
    enabled: false,
    timeDiff: false,
    color: false,
  },
  level: 'trace',
})

/**
 * Helpers
 */

const watcherContext = TestContext.create(
  (opts: TestContext.TmpDirContribution & TestContext.FsContribution) => {
    return {
      setup() {
        ExitSystem.install()
      },
      write(vfs: MemoryFS) {
        const tmpDir = opts.tmpDir()

        writeToFS(tmpDir, vfs)
      },
      async createWatcher() {
        const bufferedEvents: Event[] = []
        const watcher = await createWatcher({
          entrypointScript: `require('${path.join(opts.tmpDir(), 'entrypoint')}')`,
          sourceRoot: ctx.tmpDir(),
          cwd: ctx.tmpDir(),
          plugins: [],
          events: (e) => {
            bufferedEvents.push(e)
          },
        })

        return {
          watcher,
          bufferedEvents,
        }
      },
    }
  }
)

const ctx = TestContext.compose(TestContext.tmpDir, TestContext.fs, watcherContext)

it('restarts when a file is changed', async () => {
  ctx.setup()

  ctx.write({
    'entrypoint.ts': `process.stdout.write('toto')`,
  })

  const { watcher, bufferedEvents } = await ctx.createWatcher()

  setTimeout(() => {
    ctx.write({
      'entrypoint.ts': `process.stdout.write('titi')`,
    })
  }, 1000)

  setTimeout(async () => {
    await watcher.stop()
  }, 2000)

  await watcher.start()

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "toto",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "entrypoint.ts",
        "reason": "change",
        "type": "restart",
      },
      Object {
        "data": "titi",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a file is added', async () => {
  console.log(ctx.tmpDir())
  ctx.setup()

  ctx.write({
    'entrypoint.ts': `process.stdout.write('titi')`,
  })

  const { watcher, bufferedEvents } = await ctx.createWatcher()

  setTimeout(() => {
    ctx.write({
      'new_file.ts': ``,
    })
  }, 1000)

  setTimeout(async () => {
    await watcher.stop()
  }, 2000)

  await watcher.start()

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "file": "",
        "reason": "addDir",
        "type": "restart",
      },
      Object {
        "data": "titi",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "new_file.ts",
        "reason": "add",
        "type": "restart",
      },
      Object {
        "data": "titi",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})