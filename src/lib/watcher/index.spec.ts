import * as Lo from 'lodash'
import * as path from 'path'
import { createWatcher } from '../../../dist/lib/watcher'
import * as ExitSystem from '../exit-system'
import { rootLogger } from '../nexus-logger'
import * as TestContext from '../test-context'
import { FSSpec, writeFSSpec } from '../testing-utils'
import { Event } from './types'

ExitSystem.install()
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
      write(vfs: FSSpec) {
        const tmpDir = opts.tmpDir

        writeFSSpec(tmpDir, vfs)
      },
      async createWatcher() {
        const bufferedEvents: Event[] = []
        await new Promise((res) => setTimeout(res, 10))
        const watcher = await createWatcher({
          entrypointScript: `require('${path.join(opts.tmpDir, 'entrypoint')}')`,
          sourceRoot: opts.tmpDir,
          cwd: opts.tmpDir,
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

async function testSimpleCase(params: {
  entrypoint: string
  additionalInitialFiles?: FSSpec
  fsUpdate: () => void
}) {
  ctx.write({
    'entrypoint.ts': params.entrypoint,
    ...(params.additionalInitialFiles ?? {}),
  })

  const { watcher, bufferedEvents } = await ctx.createWatcher()

  setTimeout(() => {
    params.fsUpdate()
  }, 1000)

  setTimeout(async () => {
    await watcher.stop()
  }, 2000)

  await watcher.start()

  return { bufferedEvents }
}

it('restarts when a file is changed', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `process.stdout.write('hello')`,
    fsUpdate: () => {
      ctx.write({
        'entrypoint.ts': `process.stdout.write('world')`,
      })
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "entrypoint.ts",
        "reason": "change",
        "type": "restart",
      },
      Object {
        "data": "world",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a file is added', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `process.stdout.write('hello')`,
    fsUpdate: () => {
      ctx.write({ 'new_file.ts': `` })
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "new_file.ts",
        "reason": "add",
        "type": "restart",
      },
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a file is deleted', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `process.stdout.write('hello')`,
    additionalInitialFiles: {
      'other_file.ts': '',
    },
    fsUpdate: () => {
      ctx.fs.remove('other_file.ts')
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "other_file.ts",
        "reason": "unlink",
        "type": "restart",
      },
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a file has an error', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `throw new Error('This is an expected test error')`,
    fsUpdate: () => {
      ctx.write({ 'entrypoint.ts': `process.stdout.write('error fixed')` })
    },
  })

  expect(bufferedEvents[0].type).toBe('runner_stdio')
  expect((bufferedEvents[0] as any).data).toContain('Error: This is an expected test error')

  bufferedEvents.shift()

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "file": "entrypoint.ts",
        "reason": "change",
        "type": "restart",
      },
      Object {
        "data": "error fixed",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a dir is added', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `process.stdout.write('hello')`,
    fsUpdate: () => {
      ctx.fs.dir('new_dir')
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "new_dir",
        "reason": "addDir",
        "type": "restart",
      },
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('restarts when a dir is removed', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `process.stdout.write('hello')`,
    additionalInitialFiles: {
      dir: {},
    },
    fsUpdate: () => {
      ctx.fs.remove('dir')
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
      Object {
        "file": "dir",
        "reason": "unlinkDir",
        "type": "restart",
      },
      Object {
        "data": "hello",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})

it('handles lots of restarts', async () => {
  ctx.write({
    'entrypoint.ts': ``,
  })

  const { watcher, bufferedEvents } = await ctx.createWatcher()
  const initialDelay = 500
  const amountOfRestarts = 15
  const msBetweenEachRestarts = 50
  const msAfterAllRestarts = initialDelay + amountOfRestarts * msBetweenEachRestarts

  Lo.times(amountOfRestarts, (i) => {
    setTimeout(() => {
      ctx.write({ 'entrypoint.ts': ' '.repeat(i) })
    }, initialDelay + msBetweenEachRestarts * i)
  })

  setTimeout(() => {
    ctx.write({ 'entrypoint.ts': `process.stdout.write('done!')` })
  }, msAfterAllRestarts + 500)

  setTimeout(async () => {
    await watcher.stop()
  }, msAfterAllRestarts + 1000)

  await watcher.start()

  const printEvent = bufferedEvents.find((e) => e.type === 'runner_stdio' && e.data === 'done!')

  expect(printEvent).toMatchInlineSnapshot(`
    Object {
      "data": "done!",
      "stdio": "stdout",
      "type": "runner_stdio",
    }
  `)
})

it('does not watch node_modules, even if required', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `require('${ctx.fs.path('node_modules', 'some_file.ts')}')`,
    additionalInitialFiles: {
      node_modules: {
        'some_file.ts': `process.stdout.write('test')`,
      },
    },
    fsUpdate: () => {
      ctx.write({
        node_modules: {
          'some_file.ts': `process.stdout.write('should not reload')`,
        },
      })
    },
  })
  ctx.write({
    'entrypoint.ts': `require('${ctx.fs.path('node_modules', 'some_file.ts')}')`,
    node_modules: {
      'some_file.ts': `process.stdout.write('test')`,
    },
  })

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "test",
        "stdio": "stdout",
        "type": "runner_stdio",
      },
    ]
  `)
})
