```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
  - [Getting Started](#getting-started)
  - [Adding Prisma Framework](#adding-prisma-framework)
    - [Overview](#overview)
    - [Tutorial](#tutorial)
- [Guide](#guide)
  - [Going to Proudction](#going-to-proudction)
  - [Adding Prisma Framework](#adding-prisma-framework-1)
  - [Conventions](#conventions)
    - [`schema.ts` | `schema/*`](#schemats--schema)
    - [`app.ts`](#appts)
      - [Aliases](#aliases)
    - [Example Layouts](#example-layouts)
- [API](#api)
  - [`app`](#app)
  - [`app.addContext`](#appaddcontext)
  - [`app.<nexusDefBlock>`](#appnexusdefblock)
- [CLI](#cli)
- [Development](#development)
  - [Overview](#overview-1)
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

Setup your system

```
mkdir -p ~/projects/my-pumpkins-app
cd ~/projects/my-pumpkins-app
```

Kick off a new project

```
npx pumpkins create
```

Follow the prompts

Some highlights:

1. The `resolve` func of `users` field is strongly typed and guarantees that the shape of data returned conforms to the schema definition of `User`. There is literally zero effort for you to get this working. Just enter dev mode and start working on your app.

2. Conventions save you from configuring `pumpkins` to find your schema module.

3. You don't need a main entrypoint module. Grow into that (see later sections) as you wish.

4. Prisma integration is seamless, yet optional

## Adding Prisma Framework

### Overview

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `pumpkins` makes it easy to integrate Prisma Framework into your app. You opt-in by creating a `schema.prisma` file somewhere in your project. Then, the following things automatically happen:

1. Pumpkins CLI workflows are extended:
   1. On build, Prisma generators are run
   2. During dev, Prisma generators are run after prisma schema file changes
2. The `nexus-prisma` Nexus plugin is automatically used. This you get access to `t.model` and `t.crud`.
3. An instance of the generated Photon.JS client is a added to context under `photon` property
4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

### Tutorial

Add a schema.prisma file and fill it out with some content

```diff
mkdir -p prisma
touch prisma/schema.prisma
```

```groovy
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
}

model User {
  id   Int    @id
  name String
}
```

Initialize your database:

```
yarn prisma2 lift save --create-db --name init
yarn prisma2 lift up
```

Enter dev mode:

```
yarn pumpkins dev
```

<br>

# Guide

## Going to Proudction

Once you're ready to go to production just build your app and run the start module with node.

```
$ yarn pumpkins build
```

```
$ node node_modules/.build/start
```

## Adding Prisma Framework

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `pumpkins` makes it easy to integrate Prisma Framework into your app. Let's see how.

Add a schema.prisma file and fill it out with some content

```diff
mkdir -p prisma
touch prisma/schema.prisma
```

```groovy
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
}

model User {
  id   Int    @id
  name String
}
```

Initialize your database:

```
yarn prisma2 lift save --create-db --name init
yarn prisma2 lift up
```

The following shows an example of transitioning your API codebase to use the extensions brought on
by the Prisma extension.

Using the model DSL:

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

Using the photon instance on `ctx`:

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

<br>

## Conventions

### `schema.ts` | `schema/*`

Optional. Schema contains your GraphQL type definitions. It can be a single module or folder of modules. Multiple instances of module/folder-modules throughout your source tree is supported.

In dev mode schema modules are synchronously found and imported at server boot time. At build time however static imports for all schema modules are inlined for boot performance.

### `app.ts`

Optional. App contains the entrypoint to your service, the place where it boots. There can only be at most a single `app.ts` in your source tree.

##### Aliases

```
main.ts server.ts
```

### Example Layouts

Nothing!

```

```

Nano

```
schema.ts
```

Micro

```
app.ts
schema.ts
```

Basic

```
app/
  server.ts
  schema.ts
prisma/
  schema.prisma
```

<br>

# API

### `app`

A singleton pumpkins app. Use this to build up your GraphQL schema and configure your server.

**Example**

```ts
// schema.ts

import { app } from 'pumpkins'

app.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

### `app.addContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addContext`.

**Example**

```ts
// app.ts

import { app } from 'pumpkins'

app.addContext(req => {
  return {
    foo: 'bar',
  }
})

app.objectType({
  name: 'Foo',
  definition(t) {
    t.string('foo', (_parent, _args, ctx) => ctx.foo)
  },
})
```

### `app.<nexusDefBlock>`

Add types to your GraphQL Schema. The available nexus definition block functions include `objectType` `inputObjectType` `enumType` and so on. Refer to the [official Nexus API documentation](https://nexus.js.org/docs/api-objecttype) for more information about these functions.

**Example**

```ts
// schema.ts

import { app } from 'pumpkins'

app.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

<br>

# CLI

- [`pumpkins build`](#pumpkins-build)
- [`pumpkins dev`](#pumpkins-dev)

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

### Working with create command

In any example you can use this workflow:

```
rm -rf test-create && mcd test-create && ../node_modules/.bin/pumpkins create
```
