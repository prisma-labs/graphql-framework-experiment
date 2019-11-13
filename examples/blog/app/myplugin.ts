import { Plugin } from 'pumpkins'

type Context = {
  a: 1
}

export default {
  context: {
    typeSourcePath: __filename,
    typeExportName: 'Context',
    create: _req => {
      return { a: 1 }
    },
  },
} as Plugin<Context>
