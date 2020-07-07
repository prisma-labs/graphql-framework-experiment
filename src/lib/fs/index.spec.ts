import * as Path from 'path'
import * as FS from './'

describe('findFile', () => {
  it('ignores and does not even walk node_modules', () => {
    const startTime = Date.now()
    const result = FS.findFile('package.json', { cwd: Path.join(__dirname, '../../..') })!
    const endTime = Date.now()
    const duration = endTime - startTime
    // Should be extremely fast. Takes ~4ms on MBP for example.
    // 50 accounts for slow runs, often CI, etc.
    // This test is how we know we didn't walk node_modules, which if we did, we would get a much larger number
    expect(duration).toBeLessThan(50)
    expect(Path.basename(result)).toEqual('package.json')
  })
})
