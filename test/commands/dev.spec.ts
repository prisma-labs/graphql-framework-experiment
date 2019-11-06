import { Dev } from '../../src/cli/dev'

describe('hello', () => {
  it('prints todo', async () => {
    const spy = jest.spyOn(process.stdout, 'write')

    await Dev.run([])

    expect(spy).toHaveBeenCalledWith('todo' + '\n')
    spy.mockRestore()
  })
})
