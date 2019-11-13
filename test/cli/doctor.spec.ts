import { withContext, gitFixture } from '../__helpers'

const ctx = withContext()
  .use(gitFixture)
  .build()

it('warns if .pumpkins is not git-ignored', () => {
  expect(ctx.cli('doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "please add .pumpkins to your gitignore file
    ",
    }
  `)
})

it('validates if .pumpkins is git-ignored', () => {
  ctx.fs.write('.gitignore', '.pumpkins')
  expect(ctx.cli('doctor')).toMatchInlineSnapshot(`
    Object {
      "status": 0,
      "stderr": "",
      "stdout": "ok .pumpkins is git-ignored correctly
    ",
    }
  `)
})

// TODO test where .pumpkins has been commited to repo and so is being tracked
