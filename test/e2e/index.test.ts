import { introspectionQuery } from 'graphql'
import stripAnsi from 'strip-ansi'
import { setupE2EContext } from '../../src/utils/e2e-testing'

const ctx = setupE2EContext()

test('e2e', async () => {
  const nexusVersion = process.env.NEXUS_VERSION ?? '@latest'

  // Run npx nexus-future and kill process
  const initResult = await ctx.spawnInit(
    'npm',
    'NO_DATABASE',
    nexusVersion,
    (data, proc) => {
      console.log(data) // TODO: remove?
      if (stripAnsi(data).includes('server:listening')) {
        proc.kill()
      }
    }
  )

  expect(stripAnsi(initResult.data)).toContain('server:listening')
  expect(initResult.exitCode).toStrictEqual(0)

  // Run nexus dev and query graphql api
  await ctx.spawnNexus(['dev'], async (data, proc) => {
    if (stripAnsi(data).includes('server:listening')) {
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

  expect(stripAnsi(res.data)).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
})
