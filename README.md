```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Usage](#usage)
- [Commands](#commands)
  - [`pumpkins build`](#pumpkins-build)
  - [`pumpkins dev`](#pumpkins-dev)
  - [`pumpkins generate`](#pumpkins-generate)
  - [`pumpkins help [COMMAND]`](#pumpkins-help-command)
  - [`pumpkins init`](#pumpkins-init)
- [Development](#development)
      - [Example app Workflow](#example-app-workflow)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g pumpkins
$ pumpkins COMMAND
running command...
$ pumpkins (-v|--version|version)
pumpkins/0.0.0 darwin-x64 node-v12.12.0
$ pumpkins --help [COMMAND]
USAGE
  $ pumpkins COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`pumpkins build`](#pumpkins-build)
* [`pumpkins dev`](#pumpkins-dev)
* [`pumpkins generate`](#pumpkins-generate)
* [`pumpkins help [COMMAND]`](#pumpkins-help-command)
* [`pumpkins init`](#pumpkins-init)

## `pumpkins build`

Build a production-ready server

```
USAGE
  $ pumpkins build

OPTIONS
  -e, --entrypoint=entrypoint

EXAMPLE
  $ pumpkins build
```

## `pumpkins dev`

describe the command here

```
USAGE
  $ pumpkins dev

EXAMPLE
  $ pumpkins dev
```

## `pumpkins generate`

Generate the artifacts

```
USAGE
  $ pumpkins generate

OPTIONS
  -e, --entrypoint=entrypoint

EXAMPLE
  $ pumpkins generate
```

## `pumpkins help [COMMAND]`

display help for pumpkins

```
USAGE
  $ pumpkins help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.1/src/commands/help.ts)_

## `pumpkins init`

describe the command here

```
USAGE
  $ pumpkins init

EXAMPLE
  $ pumpkins init
```
<!-- commandsstop -->

# Development

#### Example app Workflow

```sh
yarn link && \
cd example && \
yarn link pumpkins && \
cd .. && \
yarn dev
```
