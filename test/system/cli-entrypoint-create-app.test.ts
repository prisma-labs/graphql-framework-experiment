import { introspectionQuery } from 'graphql'
import { setupE2EContext } from '../../src/utils/e2e-testing'

const ctx = setupE2EContext()

test('cli entrypoint create app', async () => {
  process.env.LOG_LEVEL = 'trace'
  process.env.CREATE_APP_CHOICE_DATABASE_TYPE = 'NO_DATABASE'
  process.env.CREATE_APP_CHOICE_PACKAGE_MANAGER_TYPE = 'npm'
  process.env.CREATE_APP_CHOICE_NEXUS_FUTURE_VERSION_EXPRESSION = `file:${ctx.getRelativePathFromCWDToLocalPackage()}`

  // Create a new app

  const createAppResult = await ctx.spawnNexusFromBuild([], (data, proc) => {
    process.stdout.write(data)
    if (data.includes('server:listening')) {
      proc.kill()
    }
  })

  expect(createAppResult.data).toContain('server:listening')
  expect(createAppResult.exitCode).toStrictEqual(0)

  // Run dev and query graphql api

  await ctx.spawnNexusFromBuild(['dev'], async (data, proc) => {
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

  // Run build

  const res = await ctx.spawnNexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
