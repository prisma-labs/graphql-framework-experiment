import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Layout from '../../framework/layout'
import { Command } from '../../lib/cli'
import { CWDProjectNameOrGenerate, generateProjectName } from '../../utils'
import { rootLogger } from '../../utils/logger'
import { run, Database } from './create/app'
import { Dev } from './dev'
import { PackageManagerType } from '../../utils/package-manager'

const log = rootLogger.child('cli').child('entrypoint')

export class __Default implements Command {
  async parse() {
    log.trace('start')
    const projectType = await Layout.scanProjectType()

    switch (projectType.type) {
      case 'new':
        log.trace(
          'detected CWD is empty and not within an existing nexus project, delegating to create sub-command'
        )
        console.log('Creating a new nexus project', {
          projectName: CWDProjectNameOrGenerate(),
          database: process.env.DATABASE_CHOICE as Database | 'NO_DATABASE', // For testing
          packageManager: process.env
            .PACKAGE_MANAGER_CHOICE as PackageManagerType, // For testing
        })
        await run({
          projectName: CWDProjectNameOrGenerate(),
          database: process.env.DATABASE_CHOICE as Database | 'NO_DATABASE', // For testing
          packageManager: process.env
            .PACKAGE_MANAGER_CHOICE as PackageManagerType, // For testing
        })
        break
      case 'NEXUS_project':
        log.trace(
          'detected CWD is within a nexus project, delegating to dev mode'
        )
        await new Dev().parse([])
        break
      case 'node_project':
        log.trace(
          'detected CWD is within a node but not nexus project, aborting'
        )
        console.log(
          "Looks like you are inside a node but not nexus project. Please either add nexus to this project's dependencies and re-run this command or navigate to a new empty folder that does not have a package.json file present in an anecestor directory."
        )
        break
      case 'unknown':
        log.trace('detected CWD is not empty nor a nexus project, aborting')
        // We can get the user on the happy path by asking them for a project
        // name and then changing into that directory.
        const projectName = generateProjectName()
        log.info(
          `creating ./${projectName} where all subsequent work will occur`
        )
        await fs.dirAsync(projectName)
        process.chdir(fs.path(projectName))
        await run({ projectName })

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
    }
  }
}
