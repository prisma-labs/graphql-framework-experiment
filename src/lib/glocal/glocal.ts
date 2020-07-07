import { stripIndent } from 'common-tags'
import * as Path from 'path'
import { rootLogger } from '../nexus-logger'
import { detectExecLayout, ExecScenario } from './detect-exec-layout'
import { globalToLocalModule } from './utils'

const log = rootLogger.child('glocal')

/**
 * Input for `setup`
 */
type SetupInput = {
  /**
   * Actual CLI code you want to run.
   */
  run: () => void
  /**
   * Name of the tool. Used in error messages.
   */
  toolName: string
  /**
   * Name of the npm package of the tool.
   */
  depName: string
  /**
   * The module entrypoint being run and to run locally. It is assumed that the
   * local and global CLIs share the exact same package module layout on disk
   * (perfect case: same versions of the package). glocal will import and thus
   * call the local-cli version of this file.
   *
   * Normally, this is just a matter of the caller passing its `__filename`.
   */
  filename: string
}

/**
 * Handle relationship between global and local versions of a cli.
 *
 * If the local project does not have the tool on disk then fatal message will
 * be logged and process exited.
 */
export function setup({ run, toolName, depName, filename }: SetupInput): void {
  // use envar to boost perf, skip costly detection work
  if (!process.env.GLOBAL_LOCAL_HANDOFF) {
    log.trace('execLayout start')
    const execLayout = detectExecLayout({ depName, scriptPath: filename })
    log.trace('execLayout done', { execLayout })

    if (execLayout.toolProject && !execLayout.runningLocalTool) {
      if (execLayout.toolCurrentlyPresentInNodeModules) {
        if (process.env.GLOBAL_LOCAL_HANDOFF) {
          log.warn('warning: multiple handoffs detected, this should not happen.')
        }

        process.env.GLOBAL_LOCAL_HANDOFF = 'true'

        globalToLocalModule({
          localPackageDir: Path.join(execLayout.project!.nodeModulesDir, depName),
          globalPackageFilename: filename,
        })
        return // we're done, all up to local now
      } else {
        log.fatal(glocalMissingLocalToolOnDiskMessage({ toolName, execLayout }))
        process.exit(1)
      }
    }
  }

  run()
}

/**
 * Message to show users when handoffs fails because local cli wasn't on disk.
 */
function glocalMissingLocalToolOnDiskMessage({
  execLayout,
  toolName,
}: {
  execLayout: ExecScenario
  toolName: string
}) {
  //todo detect package manager
  // const packageManager = await createPackageManager(undefined, { projectRoot })
  //todo instead of "try your command again" write out what that command actually was
  return stripIndent`
    The global ${toolName} CLI you invoked could not hand off to your project-local one because it wasn't on disk.
    
    This can happen for example after you have cloned a fresh copy of your project from a remote repository.

    Please install your dependencies and try your command again.

    Location of the ${toolName} CLI you invoked: ${execLayout.process.toolPath}
    Location of your project-local ${toolName} CLI: ${execLayout.project!.toolPath}
  `
}
