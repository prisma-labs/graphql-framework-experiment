```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Example](#example)
- [Conventions](#conventions)
  - [Special File Names](#special-file-names)
  - [`schema`](#schema)
  - [`context`](#context)
  - [`app`](#app)
  - [Example Layouts](#example-layouts)
- [API](#api)
  - [`createApp`](#createapp)
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

<br>

# Example

```groovy
// schema.prisma

datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
}

generator photon {
  provider = "photonjs"
}

model User {
  id   Int    @id
  name String
}

```

```ts
// schema.ts

objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
  },
})

objectType({
  name: 'Query',
  definition(t) {
    t.list.field('users', {
      type: 'User',
      resolve() {
        return [{ id: 1643, name: 'newton' }]
      },
    })
  },
})
```

```
$ prisma2 dev
```

```
$ pumpkin dev
```

<br>

# Conventions

### Special File Names

```
                    Purpose                             Alt Names

app.ts              Entrypoint                          main.ts | server.ts | service.ts
context.ts          Define GraphQL resolver context
schema.ts           Define GraphQL types                graphql.ts
schema.prisma       Define Data Models
```

### `schema.ts`

Schema contains your GraphQL type definitions. It can be a single file or folder of files. There can also be multiple instances of file/folder throughout your source tree.

During development all files will be found and dynamically synchronously imported at app construction time. At build time static imports will be generated.

```
schema.ts | graphql.ts
```

```
schema/   | graphql/
  a.ts
  b.ts
  c.ts
```

### `context.ts`

Context contains the definition of the context object that will be made available to all your GraphQL resolvers. There can only be at most a single `context.ts` file in your source tree. If you do not provide one, a defualt will be, findable in `.pumpkins`.

```
context.ts
```

### `app.ts`

App contains the entrypoint to your service, the place where it boots. There can only be at most a single `app.ts` in your source tree. If you do not provide one, a default will be, findable in `.pumpkins`.

```
app.ts | main.ts | server.ts | service.ts
```

### Prisma Support

Prisma is seamlessly supported, yet optional. You automatically opt-in when you create the schema.prisma file somewhere in your project.

```
schema.prisma
```

The following things automatically happen once Prisma is enabled.

1. Pumpkins CLI workflows are extended:
   1. On build, Prisma generators are run
   2. During dev, Prisma generators are run after prisma schema file changes
2. The `nexus-prisma` Nexus plugin is automatically used. This you get access to `t.model` and `t.crud`.
3. An instance of the generated Photon.JS client is a added to context under `photon` property
4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

### Example Layouts

Nano

```
schema.ts
```

Micro

```
app.ts
context.ts
schema.ts
```

Minimal

```
app.ts
context.ts
schema.ts
schema.prisma
```

Basic

```
app/
  app.ts
  context.ts
  graphql/
    a.ts
    b.ts
    c.ts
prisma/
  schema.prisma
```

Crazy (possible, but don't do it)

```
A/
  app.ts
  B/
    C/
      context.ts
  X/
    Y/
      Z/
        schema.ts
prisma/
  schema.prisma
```

<br>

# API

### `createApp`

Create an app instance

<br>

# CLI

<!-- commands -->

- [`pumpkins build`](#pumpkins-build)
- [`pumpkins dev`](#pumpkins-dev)
- [`pumpkins doctor`](#pumpkins-doctor)
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

_See code: [dist/cli/commands/build.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e03f7b2/dist/cli/commands/build.js)_

## `pumpkins dev`

describe the command here

```
USAGE
  $ pumpkins dev

EXAMPLE
  $ pumpkins dev
```

_See code: [dist/cli/commands/dev.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e03f7b2/dist/cli/commands/dev.js)_

## `pumpkins doctor`

Check your project state for any problems

```
USAGE
  $ pumpkins doctor
```

_See code: [dist/cli/commands/doctor.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e03f7b2/dist/cli/commands/doctor.js)_

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

_See code: [dist/cli/commands/generate.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e03f7b2/dist/cli/commands/generate.js)_

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

_See code: [dist/cli/commands/init.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e03f7b2/dist/cli/commands/init.js)_

<!-- commandsstop -->

# Development

### Overview

```

yarn
yarn test
yarn dev

```

### Example app Workflow

Because `pumpkins` controls and explicitly sets the typegen output and photon input paths we do not need to use [`NEXUS_PRISMA_LINK`](https://github.com/prisma-labs/nexus-prisma/blob/abe6c9c6f15f832c7af638f6f133ebd6c530584c/src/builder.ts#L115-L122)which is designed to aid link workflows _when using defualts_.

```sh
yarn link && \
cd examples/blog && \
yarn link pumpkins && \
cd .. && \
yarn dev
```
