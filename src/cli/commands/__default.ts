import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import { Command } from '../../lib/cli'
import * as Layout from '../../lib/layout'
import { rootLogger } from '../../lib/nexus-logger'
import { casesHandled, CWDProjectNameOrGenerate, generateProjectName } from '../../lib/utils'
import { run as runCreateApp } from './create/app'
import { Dev } from './dev'

const log = rootLogger.child('cli').child('entrypoint')

export class __Default implements Command {
  async parse() {
    log.trace('start')
    const projectType = await Layout.scanProjectType({ cwd: process.cwd() })
    switch (projectType.type) {
      case 'new':
        log.trace(
          'detected CWD is empty and not within an existing nexus project, delegating to create sub-command',
          {
            cwd: process.cwd(),
          }
        )
        await runCreateApp({
          projectName: CWDProjectNameOrGenerate(),
        })
        break
      case 'NEXUS_project':
        log.trace('detected CWD is within a nexus project, delegating to dev mode', {
          cwd: process.cwd(),
        })
        await new Dev().parse([])
        break
      case 'node_project':
        log.trace('detected CWD is within a node but not nexus project, aborting', {
          cwd: process.cwd(),
        })
        console.log(
          "Looks like you are inside a node but not nexus project. Please either add nexus to this project's dependencies and re-run this command or navigate to a new empty folder that does not have a package.json file present in an ancestor directory."
        )
        break
      case 'unknown':
        log.trace('detected CWD is not empty nor a nexus project, aborting')
        // We can get the user on the happy path by asking them for a project
        // name and then changing into that directory.
        const projectName = generateProjectName()
        log.info(`creating project directory where all subsequent work will occur`, {
          cwd: process.cwd(),
          projectName: projectName,
        })
        await fs.dirAsync(projectName)
        process.chdir(fs.path(projectName))
        await runCreateApp({
          projectName: projectName,
        })

        // It is not possible in POSIX for a process to change its parent
        // environment. Detail:
        // https://stackoverflow.com/questions/19803748/change-working-directory-in-my-current-shell-context-when-running-node-script
        // For this reason, users coming through this code path will find
        // themselves with a project that their current shell is not within. Its
        // very likely they will not notice this. Let them know now explicitly:
        console.log()
        console.log(stripIndent`
          NOTE
          ----

          Your new nexus project was created in ${projectName}. Only you can navigate into it:
          
            cd ./${projectName}
        `)
        console.log() // space after codeblock

        break
      case 'malformed_package_json':
        // todo test this case
        const e = projectType.error
        log.fatal(
          `Failed to establish a project type. A package.json was found at ${e.context.path}. But, there was an error whlie trying to read it.`,
          { reason: e.context.reason }
        )
        break
      default:
        casesHandled(projectType)
    }
  }
}
