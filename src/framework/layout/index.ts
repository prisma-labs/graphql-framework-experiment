export {
  create,
  createFromData,
  Data,
  DEFAULT_BUILD_FOLDER_NAME,
  findAppModule,
  Layout,
  loadDataFromParentProcess,
  relativeTranspiledImportPath,
  saveDataForChildProcess,
  scanProjectType,
} from './layout'

// todo refactor with TS 3.8 namespace re-export

import {
  DIR_NAME,
  emptyExceptionMessage,
  FILE_NAME,
  importModules,
  MODULE_NAME,
  printStaticImports,
} from './schema-modules'

export const schema = {
  emptyExceptionMessage,
  importModules,
  printStaticImports,
  DIR_NAME,
  MODULE_NAME,
  FILE_NAME,
}
