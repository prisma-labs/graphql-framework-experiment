import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Layout from '../../framework/layout'
import { Command } from '../../lib/cli'
import { CWDProjectNameOrGenerate, generateProjectName, pog } from '../../utils'
import { run } from './create/app'
import { Dev } from './dev'

const log = pog.sub('cli:entrypoint')

export class __Default implements Command {
  async parse() {
    log('starting')
    const projectType = await Layout.scanProjectType()

    switch (projectType.type) {
      case 'new':
        log(
          'detected CWD is empty and not within an existing nexus-future project, delegating to create sub-command'
        )
        console.log('Creating a new nexus-future project')
        await run({ projectName: CWDProjectNameOrGenerate() })
        break
      case 'NEXUS_FUTURE_project':
        log(
          'detected CWD is within a nexus-future project, delegating to dev mode'
        )
        await new Dev().parse([])
        break
      case 'node_project':
        log(
          'detected CWD is within a node but not nexus-future project, aborting'
        )
        console.log(
          "Looks like you are inside a node but not nexus-future project. Please either add nexus-future to this project's dependencies and re-run this command or navigate to a new empty folder that does not have a package.json file present in an anecestor directory."
        )
        break
      case 'unknown':
        log('detected CWD is not empty nor a nexus-future project, aborting')
        // We can get the user on the happy path by asking them for a project
        // name and then changing into that directory.
        const projectName = generateProjectName()
        console.log(
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

          Your new nexus-future project was created in ${projectName}. Only you can navigate into it:
          
            cd ./${projectName}
        `)
        console.log() // space after codeblock

        break
    }
  }
}
