import * as crypto from 'crypto'
import * as path from 'path'

const cwd = process.cwd()

export default function getCompiledPath(
  code: string,
  fileName: string,
  compiledDir: string
) {
  const hash = crypto
    .createHash('sha256')
    .update(fileName + code, 'utf8')
    .digest('hex')
  fileName = path.relative(cwd, fileName)
  const hashed = fileName.replace(/[^\w]/g, '_') + '_' + hash + '.js'
  return path.join(compiledDir, hashed)
}
