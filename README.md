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
mkdir -p graphql
touch graphql/schema.ts
touch tsconfig.json
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
// graphql/schema.ts

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

2. Conventions save you from configuring `pumpkins` to find your schema module.

3. You don't need a main entrypoint module. Grow into that as you wish.

## Adding Prisma Framework

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `pumpkins` makes it easy to integrate Prisma Framework into your app. Let's see how.

Add a schema.prisma file and fill it out with some content

```diff
mkdir -p prisma
touch prisma/schema.prisma
touch prisma/dev.db
```

```groovy
// prisma/schema.prisma

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

Enter dev mode:

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

### Modules Overview

### `schema.ts` | `schema/*`

Schema contains your GraphQL type definitions. It can be a single module or folder of modules. Multiple instances of module/folder-modules throughout your source tree is supported.

In dev mode schema modules are synchronously found and imported at server boot time. At build time however static imports for all schema modules are inlined for boot performance.

### `context.ts`

Context contains the definition of the context object that will be made available to all your GraphQL resolvers. There can only be at most a single `context.ts` file in your source tree. If you do not provide one, a defualt will be, findable in `.pumpkins`.

### `app.ts`

App contains the entrypoint to your service, the place where it boots. There can only be at most a single `app.ts` in your source tree. If you do not provide one, a default will be, findable in `.pumpkins`.

##### Aliases

```
main.ts server.ts
```

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

Typical

```
graphql/
  server.ts
  context.ts
  schema.ts
prisma/
  schema.prisma
```

Wacky

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

# Prisma Support

Prisma is optional yet seamlessly supported. You opt-in by creating a `schema.prisma` file somewhere in your project. Then, the following things automatically happen:

1. Pumpkins CLI workflows are extended:
   1. On build, Prisma generators are run
   2. During dev, Prisma generators are run after prisma schema file changes
2. The `nexus-prisma` Nexus plugin is automatically used. This you get access to `t.model` and `t.crud`.
3. An instance of the generated Photon.JS client is a added to context under `photon` property
4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

# API

### `app`

### `createApp`

Create an app instance

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
