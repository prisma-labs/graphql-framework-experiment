import { Command } from '../helpers'
import * as Layout from '../../framework/layout'
import { pog, generateProjectName, CWDProjectNameOrGenerate } from '../../utils'
import { run } from './create/app'
import { Dev } from './dev'
import * as fs from 'fs-jetpack'
import { stripIndent } from 'common-tags'

const log = pog.sub('cli:entrypoint')

export class __Default implements Command {
  async parse() {
    log('starting')
    const projectType = await Layout.scanProjectType()

    switch (projectType.type) {
      case 'new':
        log(
          'detected CWD is empty and not within an existing graphql-santa project, delegating to create sub-command'
        )
        console.log('Creating a new graphql-santa project')
        await run({ projectName: CWDProjectNameOrGenerate() })
        break
      case 'graphql-santa_project':
        log(
          'detected CWD is within a graphql-santa project, delegating to dev mode'
        )
        await new Dev().parse([])
        break
      case 'node_project':
        log(
          'detected CWD is within a node but not graphql-santa project, aborting'
        )
        console.log(
          "Looks like you are inside a node but not graphql-santa project. Please either add graphql-santa to this project's dependencies and re-run this command or navigate to a new empty folder that does not have a package.json file present in an anecestor directory."
        )
        break
      case 'unknown':
        log('detected CWD is not empty nor a graphql-santa project, aborting')
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

          Your new graphql-santa project was created in ${projectName}. Only you can navigate into it:
          
            cd ./${projectName}
        `)
        console.log() // space after codeblock

        break
    }
  }
}
