import { stripIndent } from 'common-tags'
import { buildNexusApp } from '../../lib/build/build'
import { formattedSupportedDeployTargets } from '../../lib/build/deploy-target'
import { arg, Command, isError } from '../../lib/cli'
import { rootLogger } from '../../utils/logger'

const log = rootLogger.child('cli').child('build')

const BUILD_ARGS = {
  '--output': String,
  '-o': '--output',
  '--deployment': String,
  '-d': '--deployment',
  '--stage': String,
  '--help': Boolean,
  '-h': '--help',
}

export class Build implements Command {
  async parse(argv: string[]) {
    const args = arg(argv, BUILD_ARGS)

    if (isError(args)) {
      log.error(args.stack ?? args.message)
      return this.help()
    }

    if (args['--help']) {
      return this.help()
    }

    await buildNexusApp({
      target: args['--deployment'],
      output: args['--output'],
      stage: args['--stage'],
    })
  }

  help() {
    return stripIndent`
      Usage: nexus build [flags]

      Build a production-ready nexus server

      Flags:
        -o,     --output    Relative path to output directory
        -d, --deployment    Enable custom build for some deployment platforms (${formattedSupportedDeployTargets})
        -h,       --help    Show this help message
    `
  }
}
