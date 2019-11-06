import { Dev } from '../../src/commands/dev'

describe('hello', () => {
  it('prints todo', async () => {
    const spy = jest.spyOn(process.stdout, 'write')

    await Dev.run([])

    expect(spy).toHaveBeenCalledWith('todo' + '\n')
    spy.mockRestore()
  })
})
