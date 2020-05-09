export {
  create,
  createFromData,
  Data,
  DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT,
  findAppModule,
  Layout,
  loadDataFromParentProcess,
  saveDataForChildProcess,
  scanProjectType,
  findNexusModules
} from './layout'

// todo refactor with TS 3.8 namespace re-export
// once https://github.com/prettier/prettier/issues/7263

import { emptyExceptionMessage } from './schema-modules'

export const schemaModules = {
  emptyExceptionMessage,
}
