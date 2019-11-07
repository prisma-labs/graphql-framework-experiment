```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [CLI](#cli)
  - [`pumpkins build`](#pumpkins-build)
  - [`pumpkins dev`](#pumpkins-dev)
  - [`pumpkins doctor`](#pumpkins-doctor)
  - [`pumpkins generate`](#pumpkins-generate)
  - [`pumpkins help [COMMAND]`](#pumpkins-help-command)
  - [`pumpkins init`](#pumpkins-init)
- [Development](#development)
    - [Overview](#overview)
    - [Example app Workflow](#example-app-workflow)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# CLI

<!-- commands -->
* [`pumpkins build`](#pumpkins-build)
* [`pumpkins dev`](#pumpkins-dev)
* [`pumpkins doctor`](#pumpkins-doctor)
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

_See code: [dist/cli/commands/build.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/dist/cli/commands/build.js)_

## `pumpkins dev`

describe the command here

```
USAGE
  $ pumpkins dev

EXAMPLE
  $ pumpkins dev
```

_See code: [dist/cli/commands/dev.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/dist/cli/commands/dev.js)_

## `pumpkins doctor`

Check your project state for any problems

```
USAGE
  $ pumpkins doctor
```

_See code: [dist/cli/commands/doctor.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/dist/cli/commands/doctor.js)_

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

_See code: [dist/cli/commands/generate.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/dist/cli/commands/generate.js)_

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

_See code: [dist/cli/commands/init.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0/dist/cli/commands/init.js)_
<!-- commandsstop -->

# Development

### Overview

```
yarn
yarn test
yarn dev
```

### Example app Workflow

```sh
yarn link && \
cd example && \
yarn link pumpkins && \
cd .. && \
yarn dev
```
