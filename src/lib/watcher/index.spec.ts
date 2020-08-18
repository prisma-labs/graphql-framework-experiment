import * as Lo from 'lodash'
/**
 * Test against the built JS so the runner when spawned is using require instead of import syntax which will throw in Node.
 */
import { createWatcher } from '../../../dist/lib/watcher'
import * as ExitSystem from '../exit-system'
import * as TC from '../test-context'
import { FSSpec, writeFSSpec } from '../testing-utils'
import { Event } from './types'

ExitSystem.install()
process.env.NEXUS_NO_CLEAR = 'true'

/**
 * Helpers
 */

const ctx = TC.create(TC.tmpDir(), TC.fs(), (ctx) => {
  return {
    write(vfs: FSSpec) {
      const tmpDir = ctx.tmpDir
      writeFSSpec(tmpDir, vfs)
    },
    async createWatcher() {
      const bufferedEvents: Event[] = []
      await new Promise((res) => setTimeout(res, 10))
      const watcher = await createWatcher({
        entrypointScript: `require('${ctx.path('entrypoint')}')`,
        sourceRoot: ctx.tmpDir,
        cwd: ctx.tmpDir,
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
})

async function testSimpleCase(params: {
  entrypoint: string
  additionalInitialFiles?: FSSpec
  fsUpdate: () => void
}) {
  ctx.write({
    'entrypoint.js': params.entrypoint,
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
        'entrypoint.js': `process.stdout.write('world')`,
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
        "file": "entrypoint.js",
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
      ctx.write({ 'new_file.js': `` })
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
        "file": "new_file.js",
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
      'other_file.js': '',
    },
    fsUpdate: () => {
      ctx.fs.remove('other_file.js')
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
        "file": "other_file.js",
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
      ctx.write({ 'entrypoint.js': `process.stdout.write('error fixed')` })
    },
  })

  expect(bufferedEvents[0].type).toBe('runner_stdio')
  expect((bufferedEvents[0] as any).data).toContain('Error: This is an expected test error')

  bufferedEvents.shift()

  expect(bufferedEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "file": "entrypoint.js",
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
    'entrypoint.js': ``,
  })

  const { watcher, bufferedEvents } = await ctx.createWatcher()
  const initialDelay = 500
  const amountOfRestarts = 15
  const msBetweenEachRestarts = 50
  const msAfterAllRestarts = initialDelay + amountOfRestarts * msBetweenEachRestarts

  Lo.times(amountOfRestarts, (i) => {
    setTimeout(() => {
      ctx.write({ 'entrypoint.js': ' '.repeat(i) })
    }, initialDelay + msBetweenEachRestarts * i)
  })

  setTimeout(() => {
    ctx.write({ 'entrypoint.js': `process.stdout.write('done!')` })
  }, msAfterAllRestarts + 500)

  setTimeout(async () => {
    await watcher.stop()
  }, msAfterAllRestarts + 2000)

  await watcher.start()

  expect(Lo.last(bufferedEvents)).toMatchInlineSnapshot(`
    Object {
      "data": "done!",
      "stdio": "stdout",
      "type": "runner_stdio",
    }
  `)
})

it('does not watch node_modules, even if required', async () => {
  const { bufferedEvents } = await testSimpleCase({
    entrypoint: `require('${ctx.path('node_modules/some_file.js')}')`,
    additionalInitialFiles: {
      node_modules: {
        'some_file.js': `process.stdout.write('test')`,
      },
    },
    fsUpdate: () => {
      ctx.write({
        node_modules: {
          'some_file.js': `process.stdout.write('should not reload')`,
        },
      })
    },
  })
  ctx.write({
    'entrypoint.js': `require('${ctx.path('node_modules/some_file.js')}')`,
    node_modules: {
      'some_file.js': `process.stdout.write('test')`,
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
