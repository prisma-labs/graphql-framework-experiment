import * as Path from 'path'
import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2eTestApp } from '../__helpers/e2e-system-test'

const localNexusPath = Path.join(__dirname, '..', '..')

const ctx = createE2EContext({
  localNexusPath: localNexusPath,
})

test('cli entrypoint create app', async () => {
  await e2eTestApp(
    {
      localNexus: {
        path: localNexusPath,
        createAppWithThis: true,
        pluginLinksToThis: true,
      },
    },
    ctx
  )
})
