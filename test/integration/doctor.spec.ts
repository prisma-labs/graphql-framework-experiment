import { createWorkspace } from '../__helpers'

const ws = createWorkspace({
  name: 'doctor',
})

it('warns and scaffold if there is no tsconfig', () => {
  ws.fs.write('.gitignore', '.pumpkins')
  ws.fs.remove('tsconfig.json')

  expect(ws.run('yarn -s pumpkins doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "[1m-- tsconfig.json --[22m
    [33mWarning:[39m We could not find a \\"tsconfig.json\\" file.
    [33mWarning:[39m We scaffolded one for you at tsconfig.json.
    ",
    }
  `)
})

it('errors if tsconfig is not in the project dir', () => {
  ws.fs.write('.gitignore', '.pumpkins')
  ws.fs.remove('tsconfig.json')
  ws.fs.write('../tsconfig.json', '')

  expect(ws.run('yarn -s pumpkins doctor', { require: false }))
    .toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "[31mERROR:[39m Your tsconfig.json file needs to be in your project root directory
    [31mERROR:[39m Found /private/tmp/pumpkins-integration-test-project-bases/tsconfig.json, expected /private/tmp/pumpkins-integration-test-project-bases/doctor-v5-yarnlock-201221dbef7978122d753bdd99660770-gitbranch-master-testv1/tsconfig.json
    ",
      "stdout": "[1m-- tsconfig.json --[22m
    ",
    }
  `)

  ws.fs.remove('../tsconfig.json')
})

it('validates that there is a tsconfig.json file', () => {
  ws.fs.write('.gitignore', '.pumpkins')

  expect(ws.run('yarn -s pumpkins doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "[1m-- tsconfig.json --[22m
    [32mOK:[39m \\"tsconfig.json\\" is present and in the right directory
    ",
    }
  `)
})
