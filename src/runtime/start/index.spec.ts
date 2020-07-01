import { rightOrThrow } from '@nexus/logger/dist/utils'
import * as Layout from '../../lib/layout/layout'
import { tsconfigTemplate } from '../../lib/layout/tsconfig'
import * as TC from '../../lib/test-context'
import { createStartModuleContent } from './'

const ctx = TC.create(TC.tmpDir(), TC.fs())

describe('createStartModuleContent', () => {
  it('works', async () => {
    ctx.fs.write('packge.json', { name: 'app', version: '0.0.0' })
    ctx.fs.write('app.ts', '')
    ctx.fs.write('tsconfig.json', tsconfigTemplate({ outRootRelative: 'build', sourceRootRelative: '.' }))
    const layout = await Layout.create({ cwd: ctx.fs.cwd() }).then(rightOrThrow)
    const sm = createStartModuleContent({ internalStage: 'build', runtimePluginManifests: [], layout })
    expect(sm).toMatchInlineSnapshot(`
      "// GENERATED NEXUS START MODULE


      // Run framework initialization side-effects
      // Also, import the app for later use
      import app from \\"nexus\\")


      // Last resort error handling
      process.once('uncaughtException', error => {
        app.log.fatal('uncaughtException', { error: error })
        process.exit(1)
      })

      process.once('unhandledRejection', error => {
        app.log.fatal('unhandledRejection', { error: error })
        process.exit(1)
      })


      // Import the user's app module
      require(\\"./app\\")


      app.assemble()
      app.start()"
    `)
  })
})
