import { introspectionQuery } from 'graphql'
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

  // Run nexus dev and query graphql api

  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (data.includes('server:listening')) {
      const queryResult = await ctx.client.request(`{
        worlds {
          id
          name
          population
        }
      }`)
      const introspectionResult = await ctx.client.request(introspectionQuery)

      expect(queryResult).toMatchSnapshot('query')
      expect(introspectionResult).toMatchSnapshot('introspection')
      proc.kill()
    }
  })

  // Run nexus build

  const res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
