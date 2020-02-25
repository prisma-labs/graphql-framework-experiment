import * as Path from 'path'
import * as FS from 'fs-jetpack'
import * as OS from 'os'
import * as Process from '../../../src/utils/process'
import { PackageManagerType } from '../../../src/utils/package-manager'
import { Database } from '../../../src/cli/commands/create/app'

function getTmpDir() {
  const uniqId = Math.random()
    .toString()
    .slice(2)
  const tmpDir = Path.join(OS.tmpdir(), `nexus-prisma-tmp-${uniqId}`)

  // Create dir
  FS.dir(tmpDir)

  return tmpDir
}

function setupE2EContext() {
  const BIN_PATH = FS.path('dist', 'cli', 'main.js')
  const tmpDir = getTmpDir()

  FS.dir(tmpDir)

  return {
    spawnNexus(args: string) {
      return Process.run(`${BIN_PATH} ${args}`, { cwd: tmpDir })
    },
    spawnInit(
      packageManager: PackageManagerType,
      database: Database | 'NO_DATABASE'
    ) {
      // TODO: Remove @pr.419
      return Process.run('npx nexus-future@pr.419', {
        envAdditions: {
          PACKAGE_MANAGER_CHOICE: packageManager,
          DATABASE_CHOICE: database,
        },
        cwd: tmpDir,
      })
    },
  }
}

const ctx = setupE2EContext()

test('e2e', async () => {
  const result = await ctx.spawnInit('npm', 'NO_DATABASE')

  console.log(result)
})
