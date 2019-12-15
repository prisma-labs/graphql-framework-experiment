import chalk from 'chalk'
import { arg, isError, format } from './helpers'
import { Version } from './Version'
import { unknownCommand, HelpError, Command } from '.'
import {
  CommandNamespace,
  CommandNode,
  CommandRef,
  ConcreteCommand,
  CommandsLayout,
  CommandsLayoutEntry,
} from './types'

function createCommandRef(value: string, parent: CommandNamespace): CommandRef {
  const referencedCommand = parent.value[value] as undefined | CommandNode

  if (referencedCommand === undefined) {
    throw new Error(`Unable to deref "${value}" on ${parent}`)
  }

  if (referencedCommand.type !== 'concrete_command') {
    throw new Error(
      `References must point to a concrete command. The ref "${value}" actually pointed to ${referencedCommand}.`
    )
  }

  return {
    type: 'command_reference',
    value: {
      original: value,
      commandPointer: referencedCommand,
    },
    parent,
  }
}

function createConcreteCommand(
  value: Command,
  parent: CommandNamespace
): ConcreteCommand {
  return { type: 'concrete_command', value, parent }
}

function createCommandNamespace(
  value: Record<string, CommandNode>,
  parent: null | CommandNamespace
): CommandNamespace {
  return { type: 'command_namespace', value, parent }
}

function buildCommandsTree(cmds: CommandsLayout): CommandNode {
  return buildCommandsSubTree(cmds, null)
}

function buildCommandsSubTree(
  cmds: CommandsLayout,
  parent: null | CommandNamespace
): CommandNode {
  const branch = createCommandNamespace({}, parent)
  for (const [name, cmd] of Object.entries(cmds)) {
    branch.value[name] = buildCommandsEntry(cmd, branch)
  }
  return branch
}

function buildCommandsEntry(
  cmd: CommandsLayoutEntry,
  parent: CommandNamespace
): CommandNode {
  if (typeof cmd === 'string') {
    return createCommandRef(cmd, parent)
  } else if (typeof cmd.parse === 'function') {
    return createConcreteCommand(cmd as Command, parent)
  } else if (typeof cmd === 'object') {
    return buildCommandsSubTree(cmd as CommandsLayout, parent)
  } else {
    throw new Error(`Could not process given commands layout entry: ${cmd}`)
  }
}

/**
 * Helper function for looking up a command by name on a command namespace that
 * correctly types the possibility of lookup failing.
 */
function lookupCommand(
  name: string,
  namespace: CommandNamespace
): undefined | CommandNode {
  return namespace.value[name]
}

/**
 * CLI command
 */
export class CLI implements Command {
  constructor(private readonly cmds: CommandsLayout) {}

  async parse(argv: string[]) {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--version']) {
      return Version.new().parse(argv)
    }

    if (args['--help']) {
      return this.help()
    }

    // parse the invocation path

    let targettedCommand = buildCommandsTree(this.cmds)
    while (true) {
      if (targettedCommand.type !== 'command_namespace') break

      const nextArg = args._.pop()

      if (nextArg === undefined) break

      const nextCommandNode = lookupCommand(nextArg, targettedCommand)

      if (nextCommandNode === undefined) {
        return unknownCommand(CLI.help, nextArg)
      }

      targettedCommand = nextCommandNode
    }

    // resolve and run the invocation path

    switch (targettedCommand.type) {
      case 'concrete_command':
        return targettedCommand.value.parse(args._.slice(1))
      case 'command_reference':
        return targettedCommand.value.commandPointer.value.parse(
          args._.slice(1)
        )
      case 'command_namespace':
        const nsDefault = lookupCommand('__default', targettedCommand)
        // When no sub-command given display help or the default sub-command if
        // registered
        if (nsDefault !== undefined) {
          if (nsDefault.type === 'concrete_command') {
            return nsDefault.value.parse(args._.slice(1))
          }
          if (nsDefault.type === 'command_reference') {
            return nsDefault.value.commandPointer.value.parse(args._.slice(1))
          }
          throw new Error(
            `Attempt to run namespace default failed because was not a command or reference to a command. Was: ${nsDefault}`
          )
        } else {
          // TODO should return ns help, rather than assuming root help
          return this.help()
        }
    }
  }

  // help function
  private help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  // TODO generate this from cli tree
  // static help template
  private static help = format(`
    Pumpkins - GraphQL APIs without the hassle

    ${chalk.bold('Usage')}

      ${chalk.dim(`$`)} pumpkins [command]

    ${chalk.bold('Commands')}

        create   Setup a ready-to-use Pumpkins
           dev   Develop your application in watch mode
         build   Build a production-ready server
      generate   Generate the artifacts
        doctor   Check your project state for any problems

    ${chalk.bold('Examples')}

      Initialize files for a new Pumpkins project
      ${chalk.dim(`$`)} pumpkins create

      Start developing and watch your changes locally
      ${chalk.dim(`$`)} pumpkins dev

      Build a production-ready server
      ${chalk.dim(`$`)} pumpkins build
  `)
}
