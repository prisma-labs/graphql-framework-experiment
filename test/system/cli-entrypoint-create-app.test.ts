import * as Path from 'path'
import { setupE2EContext } from '../../src/lib/e2e-testing'
import { e2eTestApp } from '../__helpers/e2e-system-test'

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

  await e2eTestApp(ctx)
})
