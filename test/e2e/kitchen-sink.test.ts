import { createE2EContext } from '../../src/lib/e2e-testing'
import { e2eKitchenSink } from '../__helpers/e2e/kitchen-sink'

const ctx = createE2EContext({ localNexus: null, serverPort: 4001 })

test('kitchen sink', async () => {
  await e2eKitchenSink(ctx)
})
