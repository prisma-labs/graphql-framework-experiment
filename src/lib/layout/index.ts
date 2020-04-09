export {
  create,
  createFromData,
  Data,
  DEFAULT_BUILD_FOLDER_PATH_RELATIVE_TO_PROJECT_ROOT,
  findAppModule,
  Layout,
  loadDataFromParentProcess,
  mustLoadDataFromParentProcess,
  saveDataForChildProcess,
  scanProjectType,
} from './layout'

// todo refactor with TS 3.8 namespace re-export
// once https://github.com/prettier/prettier/issues/7263

import { CONVENTIONAL_SCHEMA_FILE_NAME, DIR_NAME, emptyExceptionMessage, MODULE_NAME } from './schema-modules'

export const schema = {
  emptyExceptionMessage,
  DIR_NAME,
  MODULE_NAME,
  CONVENTIONAL_SCHEMA_FILE_NAME,
}
