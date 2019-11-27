import { createWorkspace } from '../../__helpers'
import { BUILD_FOLDER_NAME } from '../../../src/constants'

const ws = createWorkspace({
  name: 'prisma-build',
})

it('can build a prisma framework project', () => {
  ws.fs.write(
    'schema.prisma',
    `	
      datasource db {	
        provider = "sqlite"	
        url      = "file:dev.db"	
      }	
      generator photon {	
        provider = "photonjs"	
      }	
      model User {	
        id   Int    @id	
        name String	
      }	
    `
  )

  ws.fs.write(
    'schema.ts',
    `
      import { app } from 'pumpkins'

      app.objectType({
        name: 'User',
        definition(t) {
          t.model.id()
          t.model.name()
        }
      })
    `
  )

  const result = ws.run('yarn -s pumpkins build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(BUILD_FOLDER_NAME)).toMatchSnapshot()
})
