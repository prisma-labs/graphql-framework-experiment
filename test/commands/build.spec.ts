import { Build } from '../../src/commands/build'

describe('hello', () => {
  it('prints todo', async () => {
    const spy = jest.spyOn(process.stdout, 'write')

    await Build.run([])

    expect(spy).toHaveBeenCalledWith('todo' + '\n')
    spy.mockRestore()
  })
})
