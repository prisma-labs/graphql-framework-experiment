import { DMMF } from '@prisma/photon/runtime/dmmf-types'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { Layout } from '../../framework/layout'

function renderMissingType(typeName: string, fields: string[]) {
  return `\
import { app } from 'pumpkins'

app.objectType({
  name: '${typeName}',
  definition(t) {
${fields.map(f => `    t.model.${f}()`).join('\n')}
  }
})
  `
}

export function autoFixUnknownFieldType(
  layout: Layout,
  unknownFieldType: string
) {
  const dmmf = require('@prisma/photon').dmmf as DMMF.Document
  const fields = dmmf.datamodel.models
    .find(m => m.name === unknownFieldType)!
    .fields.map(f => f.name)
  const renderedMissingType = renderMissingType(unknownFieldType, fields)

  if (
    layout.schemaModules.length === 1 &&
    fs.inspect(layout.schemaModules[0])?.type === 'file'
  ) {
    fs.append(layout.schemaModules[0], '\n' + renderedMissingType)
  } else {
    const dir = layout.schemaModules[0]
    let fileName = path.join(dir, `${unknownFieldType}.ts`)

    if (fs.exists(fileName)) {
      fileName = path.join(dir, `${unknownFieldType}-scaffolded.ts`)
    }

    if (fs.exists(fileName)) {
      fileName = path.join(dir, `${unknownFieldType}-rename-me.ts`)
    }


    fs.write(fileName, renderedMissingType)
  }
}
