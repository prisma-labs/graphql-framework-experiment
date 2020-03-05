import { introspectionQuery } from 'graphql'
import { CONVENTIONAL_SCHEMA_FILE_NAME } from '../../src/framework/layout/schema-modules'
import { setupE2EContext } from '../../src/utils/e2e-testing'

const ctx = setupE2EContext()

test('e2e', async () => {
  const nexusVersion = process.env.E2E_NEXUS_VERSION ?? 'latest'

  // Run npx nexus-future and kill process

  const createAppResult = await ctx.spawnNPXNexus(
    'npm',
    'NO_DATABASE',
    nexusVersion,
    (data, proc) => {
      process.stdout.write(data)
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

      export interface B {
        foo: number
      }

      const b: B = { foo: 1 }

      schema.addToContext(req => {
        return { a: 1, b: b }
      })

      schema.extendType({
        type: 'Query',
        definition(t) { 
          t.int('a', (_parent, _args, ctx) => { 
            return ctx.a + ctx.b.foo
          })
        }
      })
    `
  )

  // Run nexus dev and query graphql api

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

  // Run nexus build

  const res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
