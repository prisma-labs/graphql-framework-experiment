```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎃
```

# pumpkins <!-- omit in toc -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
  - [Getting Started](#getting-started)
  - [Next Step, Getting a Sense for End to End Type Safety](#next-step-getting-a-sense-for-end-to-end-type-safety)
- [Guide](#guide)
  - [Adding Prisma](#adding-prisma)
    - [Overview](#overview)
    - [Example](#example)
  - [Databases](#databases)
    - [Setup a local postgres](#setup-a-local-postgres)
  - [Going to Proudction](#going-to-proudction)
    - [Heroku](#heroku)
  - [Conventions](#conventions)
    - [`schema.ts` | `schema/*`](#schemats--schema)
      - [About](#about)
      - [Aliases](#aliases)
    - [`app.ts`](#appts)
      - [About](#about-1)
      - [Aliases](#aliases-1)
    - [Example Layouts](#example-layouts)
- [API](#api)
  - [`app`](#app)
  - [`app.addToContext`](#appaddtocontext)
  - [`app.<nexusDefBlock>`](#appnexusdefblock)
  - [`app.server.start`](#appserverstart)
- [CLI](#cli)
- [Development](#development)
  - [Overview](#overview-1)
  - [Testing](#testing)
  - [Working With Example Apps via Linking](#working-with-example-apps-via-linking)
  - [Working with create command](#working-with-create-command)

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

1. For this tutorial we will use postgres. Install it if needed and then get its connection URL. If in doubt check out [our db setup guide](#setup-a-local-postgres).

2. Kick off a new project. Say yes to the prisma option.

   ```
   npx pumpkins@master
   ```

   Some highlights of what you'll see:

   - The `resolve` func of `users` field is strongly typed and guarantees that the shape of data returned conforms to the schema definition of `User`. There is literally zero effort for you to get this working. Just enter dev mode and start working on your app.

   - Conventions save you from configuring `pumpkins` to find your schema module.

   - You don't need a main entrypoint module. Grow into that (see later sections) as you wish.

   - Prisma integration is seamless, yet optional

### Next Step, Getting a Sense for End to End Type Safety

The following will give you a sense for the powerful mechanics going on under
the hood.

Our Hello World schema doesn't account for information about moons, lets change that.

1. Start by updating our data layer to model information about moons. We don't want to go crazy scientific here but a bit of modelling will serve us well. A world may have more than one moon, and a moon may have properites in its own right. So lets give moons a first class model representation. Then, we can connect them to their respective worlds:

   ```diff
     model World {
       id         Int    @id
       name       String @unique
       population Float
   +   moons      Moon[]
     }

   + model Moon {
   +   id    Int    @id
   +   name  String
   +   world World
   + }
   ```

   `pumpkins` reacts to changes in your Prisma schema. By saving the above, your dev database will be automatically migrated and photon regenerated. You literally now just move on to updating your GraphQL API.

2. We have data about `Earth` from before, but now we need to update it with information about its moon. Instead of working with photon inside one-off scripts, lets enhance our API and make the update as if a client app were.

   We're going to need to expose the `moons` world field to clients

   ```diff
     app.objectType({
       name: "World",
       definition(t) {
         t.model.id()
         t.model.name()
         t.model.population()
   +     t.model.moons()
       }
     })
   ```

   Upon doing this however, we will see a warning in our dev mode logs:

   ```
    Warning: Your GraphQL `World` object definition is projecting a field `moons` with `Moon` as output type, but `Moon` is not defined in your GraphQL Schema
    Warning: in /Users/jasonkuhrt/foobar/app/schema.ts:10:13

      6 definition(t) {
      7 t.model.id();
      8 t.model.name();
      9 t.model.population();
    → 10 t.model.moons();
   ```

   The feedback is pretty clear already but to restate: The problem is that we're project a Prisma model field (`moons`) that is a connection to another Prisma model (`Moon`) that has not been projected on our API layer. So let's do that now:

   ```diff
   +app.objectType({
   +  name:'Moon',
   +  definition(t){
   +    t.model.id()
   +    t.model.name()
   +    t.model.world()
   +   }
   +})
   ```

   Do not copy-paste. Instead type this out yourself and take note how autcompletion within the `definition` block on `t.model` effectively guides you to success.

   Once you have projected `Moon` from your data layer to your API layer, you will see that the dev mode warning and TypeScript error are now resolved. 🙌

   If you go to your GraphQL Playground now you will see that your GraphQL schema now contains your Moon data shape too. But of course we still need to update `Earth` with data about _its_ moon. To achieve that we're going to expose CRUD actions that clients can use to update `Earth`.

   ```diff
   +app.mutationType({
   +  definition(t){
   +    t.crud.updateOneWorld()
   +  }
   +})
   ```

   Again do not copy-paste. Type this out and see how it feels. Notice how auto-completion guides you from start to finish.

   If we go back to our schema in GraphQL Playground now, we'll see a significant number of additions to the schema, a result of the CRUD features we've just enabled.

   Now, let's give `Earth` its moon!

   ```gql
   mutation addMoonToEarth {
     updateOneWorld(
       where: { name: "Earth" }
       data: { moons: { create: { name: "moon" } } }
     ) {
       name
       moons {
         name
       }
     }
   }
   ```

   You should see a result like:

   ```json
   {
     "data": {
       "updateOneWorld": {
         "name": "Earth",
         "moons": [
           {
             "name": "moon"
           }
         ]
       }
     }
   }
   ```

3. Conclusion

   Hopefully that gives you a taste of the power under your finger tips. There's a ton more to discover. Happy coding! 🙌

# Guide

## Adding Prisma

### Overview

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `pumpkins` makes it easy to integrate Prisma Framework into your app. You opt-in by creating a `schema.prisma` file somewhere in your project. Then, the following things automatically happen:

1. Pumpkins CLI workflows are extended:
   1. On build, Prisma generators are run
   2. During dev, Prisma generators are run after prisma schema file changes
2. The `nexus-prisma` Nexus plugin is automatically used. This you get access to `t.model` and `t.crud`.
3. An instance of the generated Photon.JS client is a added to context under `photon` property
4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

### Example

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

## Databases

### Setup a local postgres

The reccommended way to run postgres locally is with docker, because it is easy flexible and reliable.

1. Start a postgres server for your app:

   ```
   docker run --detach --publish 5432:5432 --name 'myapp-db' --env POSTGRES_PASSWORD=pumpkins postgres
   ```

2. Now you can use a connection URL like:

   ```
   postgresql://postgres:pumpkins@localhost:5432/myapp
   ```

If you don't want to use a docker, here are some links to alternative approaches:

- [With Homebrew](https://wiki.postgresql.org/wiki/Homebrew)

<br>

## Going to Proudction

Once you're ready to go to production just build your app and run the start module with node.

```
$ yarn pumpkins build
```

```
$ node node_modules/.build
```

### Heroku

```json
  "scripts": {
    "build": "pumpkins build",
    "start": "node node_modules/.build"
  }
```

<br>

## Conventions

### `schema.ts` | `schema/*`

Optional –– Your GraphQL type definitions.

##### About

It can be a single module or folder of modules. Multiple instances of module/folder-modules throughout your source tree is supported.

In dev mode schema modules are synchronously found and imported at server boot time. At build time however static imports for all schema modules are inlined for boot performance.

##### Aliases

n/a

### `app.ts`

Optional –– The entrypoint to your app

##### About

There can only be at most a single `app.ts`/`server.ts`/`service.ts` module in your source tree.

This module is optional **when** you just have schema modules and so pumpkins already knows how import them into the final build. Otherwise you'll need this module to import your custom modules etc.

##### Aliases

```
server.ts service.ts
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

### `app.addToContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addToContext`.

**Example**

```ts
// app.ts

import { app } from 'pumpkins'

app.addToContext(req => {
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

### `app.server.start`

Start the server. If you don't call this pumpkins will. Usually you should not have to call it. Please share your use-case with us if you do!

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
