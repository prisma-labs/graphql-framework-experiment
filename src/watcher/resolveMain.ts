import * as Resolve from 'resolve'

export default function(main: string) {
  const opts = {
    basedir: process.cwd(),
    paths: [process.cwd()],
  }

  try {
    return Resolve.sync(main + '.ts', opts)
  } catch (e) {
    try {
      return Resolve.sync(main + '/index.ts', opts)
    } catch (e) {
      return Resolve.sync(main, opts)
    }
  }
}
