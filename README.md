# pumpkins

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/pumpkins.svg)](https://npmjs.org/package/pumpkins)
[![CircleCI](https://circleci.com/gh/prisma-labs/pumpkins/tree/master.svg?style=shield)](https://circleci.com/gh/prisma-labs/pumpkins/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/pumpkins.svg)](https://npmjs.org/package/pumpkins)
[![License](https://img.shields.io/npm/l/pumpkins.svg)](https://github.com/prisma-labs/pumpkins/blob/master/package.json)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
  <!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g pumpkins
$ pumpkins COMMAND
running command...
$ pumpkins (-v|--version|version)
pumpkins/0.0.0 darwin-x64 node-v10.17.0
$ pumpkins --help [COMMAND]
USAGE
  $ pumpkins COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`pumpkins build`](#pumpkins-build)
- [`pumpkins dev`](#pumpkins-dev)
- [`pumpkins generate`](#pumpkins-generate)
- [`pumpkins help [COMMAND]`](#pumpkins-help-command)
- [`pumpkins init`](#pumpkins-init)

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

_See code: [lib/cli/build.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/lib/cli/build.js)_

## `pumpkins dev`

describe the command here

```
USAGE
  $ pumpkins dev

EXAMPLE
  $ pumpkins dev
```

_See code: [lib/cli/dev.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/lib/cli/dev.js)_

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

_See code: [lib/cli/generate.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/lib/cli/generate.js)_

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

_See code: [lib/cli/init.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/lib/cli/init.js)_
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
