interface Package {
  name: string
  version: string
}

export const ownPackage: Package = require('../../../package.json')
