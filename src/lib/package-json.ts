import { Either, isLeft, left, right, toError, tryCatch } from 'fp-ts/lib/Either'
import * as FS from 'fs-jetpack'
import { isEmpty, isPlainObject, isString } from 'lodash'
import parseJson from 'parse-json'
import * as Path from 'path'
import { PackageJson } from 'type-fest'
import { ContextualError } from './contextual-error'

export class MalformedPackageJsonError extends ContextualError<{ path: string }> {}

export type Result = {
  path: string
  dir: string
  contents: Either<MalformedPackageJsonError, PackageJson>
} | null

/**
 * Find the package.json file path. Looks recursively upward to disk root.
 * Starts looking in CWD If no package.json found along search, returns null.
 * If packge.json fonud but fails to be parsed or fails validation than an error is returned.
 */
export function findRecurisvelyUpwardSync(opts: { cwd: string }): Result {
  let found: Result = null
  let currentDir = opts.cwd
  const localFS = FS.cwd(currentDir)

  while (true) {
    const filePath = Path.join(currentDir, 'package.json')
    const rawContents = localFS.read(filePath)

    if (rawContents) {
      const contents = parse(rawContents, filePath)
      found = { dir: currentDir, path: filePath, contents }
      break
    }

    if (currentDir === '/') {
      break
    }

    currentDir = Path.join(currentDir, '..')
  }

  return found
}

/**
 * Parse package.json contents.
 */
export function parse(contents: string, path: string) {
  const errRawData = tryCatch(
    () => parseJson(contents),
    (e) => new MalformedPackageJsonError(toError(e).message, { path })
  )
  if (isLeft(errRawData)) return errRawData
  const rawData = errRawData.right
  if (!isPlainObject(rawData))
    return left(new MalformedPackageJsonError('Package.json data is not an object', { path }))
  if (!isString(rawData.name))
    return left(new MalformedPackageJsonError('Package.json name field is not a string', { path }))
  if (isEmpty(rawData.name))
    return left(new MalformedPackageJsonError('Package.json name field is empty', { path }))
  if (!isString(rawData.version))
    return left(new MalformedPackageJsonError('Package.json version field is not a string', { path }))
  if (isEmpty(rawData.version))
    return left(new MalformedPackageJsonError('Package.json version field is empty', { path }))
  return right(rawData as PackageJson & { name: string; version: string })
}
