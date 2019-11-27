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
      "stdout": "-- .gitignore --
    Warning:  Please add .pumpkins to your gitignore file
    -- tsconfig.json --
    OK: \\"tsconfig.json\\" is present and in the right directory
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
      "stdout": "-- .gitignore --
    OK:  .pumpkins is git-ignored correctly
    -- tsconfig.json --
    OK: \\"tsconfig.json\\" is present and in the right directory
    ",
    }
  `)
})

it('warns and scaffold if there is no tsconfig', () => {
  ws.fs.write('.gitignore', '.pumpkins')
  ws.fs.remove('tsconfig.json')

  expect(ws.run('yarn -s pumpkins doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "-- .gitignore --
    OK:  .pumpkins is git-ignored correctly
    -- tsconfig.json --

    Warning: We could not find a \\"tsconfig.json\\" file.
    Warning: We scaffolded one for you at /private/tmp/pumpkins-integration-test-project-bases/doctor-v5-yarnlock-319895dfc0c76e09f06a149233eb6be6-gitbranch-master-testv1/tsconfig.json.
        
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
      "stderr": "ERROR: Your tsconfig.json file needs to be in your project root directory
    ERROR: Found /private/tmp/pumpkins-integration-test-project-bases/tsconfig.json, expected /private/tmp/pumpkins-integration-test-project-bases/doctor-v5-yarnlock-319895dfc0c76e09f06a149233eb6be6-gitbranch-master-testv1/tsconfig.json
    ",
      "stdout": "-- .gitignore --
    OK:  .pumpkins is git-ignored correctly
    -- tsconfig.json --
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
      "stdout": "-- .gitignore --
    OK:  .pumpkins is git-ignored correctly
    -- tsconfig.json --
    OK: \\"tsconfig.json\\" is present and in the right directory
    ",
    }
  `)
})
