/**
 * Create our own chalk singleton so that when pretty mode of the logger is used
 * it alters only its own instance of chalk and not the singleton exported by
 * the package that might be being used by anything else in the process.
 */

import chalkPackageSingleton from 'chalk'

export const chalk = new chalkPackageSingleton.Instance()

export { Chalk } from 'chalk'
