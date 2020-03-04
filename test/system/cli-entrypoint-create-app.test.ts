import { introspectionQuery } from 'graphql'
import * as Path from 'path'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../src/framework/layout/schema-modules'
import { setupE2EContext } from '../../src/utils/e2e-testing'

const ctx = setupE2EContext({
  linkedPackageMode: true,
})

const BIN_PATH = Path.join(__dirname, '..', '..', 'dist', 'cli', 'main')

test('cli entrypoint create app', async () => {
  process.env.CREATE_APP_CHOICE_DATABASE_TYPE = 'NO_DATABASE'
  process.env.CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE = 'npm'

  // Create a new app

  const createAppResult = await ctx.spawnNexusFromPath(
    BIN_PATH,
    [],
    (data, proc) => {
      if (data.includes('server:listening')) {
        proc.kill()
      }
    }
  )

  expect(createAppResult.data).toContain('server:listening')
  expect(createAppResult.exitCode).toStrictEqual(0)

  // Cover addToContext feature

  await ctx.fs.writeAsync(
    `./src/more/${CONVENTIONAL_SCHEMA_FILE_NAME}`,
    `
      import { schema } from 'nexus-future'

      schema.addToContext(req => {
        return { a: 1 }
      })

      schema.extendType({
        type: 'Query',
        definition(t) { 
          t.int('a', (_parent, _args, ctx) => { 
            return ctx.a
          })
        }
      })
    `
  )

  // Run dev and query graphql api

  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (data.includes('server:listening')) {
      let result: any
      result = await ctx.client.request(`{
        worlds {
          id
          name
          population
        }
      }`)
      expect(result).toMatchSnapshot('query')

      result = await ctx.client.request(introspectionQuery)
      expect(result).toMatchSnapshot('introspection')

      result = await ctx.client.request(`{ a }`)
      expect(result).toMatchSnapshot('addToContext query')

      proc.kill()
    }
  })

  // Run build

  const res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
