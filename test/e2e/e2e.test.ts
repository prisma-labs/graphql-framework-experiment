import { setupE2EContext } from '../../src/lib/e2e-testing'
import { e2eTestApp } from '../__helpers/e2e-system-test'

const ctx = setupE2EContext()

test('e2e', async () => {
  await e2eTestApp({ local: false }, ctx)
})
