```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Introduction](#introduction)
    - [Getting Started](#getting-started)
  - [Adding Prisma Framework](#adding-prisma-framework)
- [Conventions](#conventions)
    - [Special File Names](#special-file-names)
    - [`schema.ts`](#schemats)
    - [`context.ts`](#contextts)
    - [`app.ts`](#appts)
    - [Prisma Support](#prisma-support)
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
    - [Testing](#testing)
    - [Working With Example Apps via Linking](#working-with-example-apps-via-linking)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<br>

# Introduction

Pumpkins is a GraphQL API framework. It takes a code-first approach (as opposed
to schema-first) and brings together a set of tools that provide robust type
safety so that if your app compiles, you have a much higher degree of confidence
than with vanilla JavaScript or just TypeScript.

Pumpkins brings Nexus, Prisma, Apollo Server and more together into a pluggable
system (in fact Prisma features are implemented as a plugin).

### Getting Started

```
yarn init -y
yarn add pumpkins@sha
```

Add some files to get your app going:

```
mkdir -p app
touch schema.ts
```

Fill out your modules with some initial code:

```ts
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "strict": true
  }
}
```

```ts
// schema.ts

objectType({
  name: 'User',
  definition(t) {
    t.id('id')
    t.string('name')
  },
})

queryType({
  definition(t) {
    t.list.field('users', {
      type: 'User',
      resolve() {
        return [{ id: '1643', name: 'newton' }]
      },
    })
  },
})
```

You will see some static type errors. These will go away once you boot your app. Give it a shot:

```
$ yarn pumpkins dev
```

Go to http://localhost:4000/graphql and try this query:

```gql
query {
  users {
    id
    name
  }
}
```

You should get back:

```json
{
  "data": {
    "users": [
      {
        "id": "1643",
        "name": "newton"
      }
    ]
  }
}
```

Once you're ready to go to production just build the app to get a ready-to-go node dist.

```
$ pumpkins build
```

Reflecting on what we've just seen;

1. The `resolve` func of `users` field is strongly typed and guarantees that the shape of data returned conforms to the schema definition of `User`. There is literally zero effort for you to get this working. Just enter dev mode and start working on your app.

2. Flexible convention-over-configuration saves you from configuring `pumpkins` to find your entrypoint and schema modules.

3. You don't have to provide a `app.ts` entrypoint up front. Grow into it as you wish.

## Adding Prisma Framework

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `pumpkins` makes it easy to integrate Prisma Framework into your app. Let's see how.

Add a schema.prisma file and fill it out with some content

```diff
mkdir -p prisma
touch prisma/schema.prisma
touch prisma/dev.db
```

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

Initialize your database:

```
yarn prisma2 lift save
yarn prisma2 lift up
```

Run prisma generate followed by dev mode:

```
yarn pumpkins dev
```

Now we can go back and and integrate our data layer into our GraphQL API:

```diff
  objectType({
    name: 'User',
    definition(t) {
-     t.id('id)
-     t.string('name')
+     t.model.id()
+     t.model.name()
    },
  })
```

After doing this you will see a static type error on our `users` field resolver. This is because the user `id` field has changed from an `ID` type to a `Int` type. We don't need to resolve this directly though because we'll rewrite our resolver to talk to a real database now. The behind-the-scenes prisma integration has already given us a photon client ready to use on the resolver context object.

```diff
  queryType({
    definition(t) {
      t.list.field('users', {
        type: 'User',
-       resolve() {
-         return [{ id: '1643', name: 'newton' }]
+       resolve(_root, _args, ctx) {
+         return ctx.photon.users.findMany()
        },
      })
    },
  })
```

Finally lets try our query again at http://localhost:4000/graphql:

```gql
query {
  users {
    id
    name
  }
}
```

You should get back:

```json
{
  "data": {
    "users": []
  }
}
```

Reflecting on what we've just seen;

1. Integrating Prisma is literally a matter of just using it. `pumpkins` will react to the presence of a `schema.prisma`, run Prisma generators, setup Photon.js, and setup `nexus-prisma` Nexus plugin.

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

_See code: [dist/cli/commands/build.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e4f6989/dist/cli/commands/build.js)_

## `pumpkins dev`

describe the command here

```
USAGE
  $ pumpkins dev

EXAMPLE
  $ pumpkins dev
```

_See code: [dist/cli/commands/dev.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e4f6989/dist/cli/commands/dev.js)_

## `pumpkins doctor`

Check your project state for any problems

```
USAGE
  $ pumpkins doctor
```

_See code: [dist/cli/commands/doctor.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e4f6989/dist/cli/commands/doctor.js)_

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

_See code: [dist/cli/commands/generate.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e4f6989/dist/cli/commands/generate.js)_

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

_See code: [dist/cli/commands/init.js](https://github.com/prisma-labs/pumpkins/blob/v0.0.0-sha.e4f6989/dist/cli/commands/init.js)_

<!-- commandsstop -->

# Development

### Overview

```
yarn
yarn test
yarn dev
```

### Testing

Integration tests rely on `npm link`. This means those integration tests cannot
work on a machine that has not done `npm link` inside the root of the cloned
repo.

The reason we do not use `yarn link` is that yarn [does not symlink the bin into
local node_modules](https://github.com/yarnpkg/yarn/issues/5713).

### Working With Example Apps via Linking

Refer to https://github.com/prisma/pumpkins-examples
