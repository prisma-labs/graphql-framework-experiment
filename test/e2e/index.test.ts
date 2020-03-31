import { setupE2EContext } from '../../src/lib/e2e-testing'
import { e2eTestApp } from '../__helpers/e2e-system-test'

const ctx = setupE2EContext()

test('e2e', async () => {
  const nexusVersion = process.env.E2E_NEXUS_VERSION ?? 'latest'

  // Run npx nexus and kill process

  const createAppResult = await ctx.spawnNPXNexus(
    'npm',
    'NO_DATABASE',
    nexusVersion,
    (data, proc) => {
      process.stdout.write(data)
      if (data.includes('server listening')) {
        proc.kill()
      }
    }
  )

  expect(createAppResult.data).toContain('server listening')
  expect(createAppResult.exitCode).toStrictEqual(0)

  await e2eTestApp(ctx)
})
