import { DEFAULT_BUILD_FOLDER_NAME } from '../../../src/framework/layout'
import { FILE_NAME } from '../../../src/framework/layout/schema-modules'
import { createWorkspace } from '../../__helpers'

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
    FILE_NAME,
    `
      import app from 'nexus-future'

      app.schema.objectType({
        name: 'User',
        definition(t) {
          t.model.id()
          t.model.name()
        }
      })
    `
  )

  const result = ws.run('yarn -s nexus build')
  expect(result).toMatchSnapshot()
  expect(ws.fs.inspectTree(DEFAULT_BUILD_FOLDER_NAME)).toMatchSnapshot()
})
