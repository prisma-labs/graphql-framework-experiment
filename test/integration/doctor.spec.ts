import { createWorkspace } from '../__helpers'

const ws = createWorkspace({
  name: 'doctor',
})

// TODO test where .pumpkins has been commited to repo and so is being tracked

it('warns if .pumpkins is not git-ignored', () => {
  expect(ws.run('yarn -s pumpkins doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "please add .pumpkins to your gitignore file
    ",
    }
  `)
})

it('validates if .pumpkins is git-ignored', () => {
  ws.fs.write('.gitignore', '.pumpkins')
  expect(ws.run('yarn -s pumpkins doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "ok .pumpkins is git-ignored correctly
    ",
    }
  `)
})
