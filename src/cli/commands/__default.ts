import { Command } from '../helpers'
import * as Layout from '../../framework/layout'
import { pog, generateProjectName, CWDProjectNameOrGenerate } from '../../utils'
import { run } from './create'
import { Dev } from './dev'
import * as fs from 'fs-jetpack'

const log = pog.sub('cli:entrypoint')

export class __Default implements Command {
  async parse() {
    log('starting')
    const projectType = await Layout.scanProjectType()

    switch (projectType.type) {
      case 'new':
        log(
          'detected CWD is empty and not within an existing pumpkins project, delegating to create sub-command'
        )
        console.log('Creating a new pumpkins project')
        await run({ projectName: CWDProjectNameOrGenerate() })
        break
      case 'pumpkins_project':
        log('detected CWD is within a pumpkins project, delegating to dev mode')
        await new Dev().parse()
        break
      case 'node_project':
        log('detected CWD is within a node but not pumpkins project, aborting')
        console.log(
          "Looks like you are inside a node but not pumpkins project. Please either add pumpkins to this project's dependencies and re-run this command or navigate to a new empty folder that does not have a package.json file present in an anecestor directory."
        )
        break
      case 'unknown':
        log('detected CWD is not empty nor a pumpkins project, aborting')
        // We can get the user on the happy path by asking them for a project
        // name and then changing into that directory.
        const projectName = generateProjectName()
        await fs.dirAsync(projectName)
        process.chdir(fs.path(projectName))
        await run({ projectName })
        break
    }
  }
}
