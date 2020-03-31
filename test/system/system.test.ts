import * as Path from 'path'
import { setupE2EContext } from '../../src/lib/e2e-testing'
import { e2eTestApp } from '../__helpers/e2e-system-test'

const ctx = setupE2EContext({
  linkedPackageMode: true,
  localNexusBinPath: Path.join(__dirname, '..', '..', 'dist', 'cli', 'main'),
})

test('cli entrypoint create app', async () => {
  await e2eTestApp({ local: true }, ctx)
})
