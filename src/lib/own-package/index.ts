interface PackageJson {
  name: string
  version: string
  dependencies?: Record<string, string>
}

export const ownPackage: PackageJson = require('../../../package.json')
