```
Please beware that this is a PROTOTYPE. Do NOT use this for serious work. Thanks! 🎄
```

# graphql-santa <!-- omit in toc -->

[![image](https://user-images.githubusercontent.com/284476/71212025-786f3880-227e-11ea-9dee-467239d46993.png)](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

`graphql-santa` is a GraphQL API framework. It takes a code-first approach and brings together a set of tools that provide robust type safety so that if your app compiles, you have a high degree of confidence that it works.

Tools and libraries used include:

- TypeScript
- Express
- Nexus
- Apollo Server

**Contents**

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Tutorial](#tutorial)
- [Recipes](#recipes)
  - [Add Prisma](#add-prisma)
  - [Setup a local PostgreSQL](#setup-a-local-postgresql)
  - [Go to proudction](#go-to-proudction)
  - [Go to production with Prisma, Heroku, Heroku PostgreSQL](#go-to-production-with-prisma-heroku-heroku-postgresql)
- [Conventions](#conventions)
  - [`schema.ts` | `schema/*`](#schemats--schema)
  - [`app.ts`](#appts)
  - [Example Layouts](#example-layouts)
- [API](#api)
  - [`app`](#app)
    - [`app.addToContext`](#appaddtocontext)
    - [`app.<nexusDefBlock>`](#appnexusdefblock)
    - [`app.logger`](#applogger)
    - [`app.server`](#appserver)
  - [`Server`](#server)
    - [`server.start`](#serverstart)
    - [`serve.stop`](#servestop)
  - [`Logger`](#logger)
    - [`logger.fatal`](#loggerfatal)
    - [`logger.error`](#loggererror)
    - [`logger.warn`](#loggerwarn)
    - [`logger.info`](#loggerinfo)
    - [`logger.debug`](#loggerdebug)
    - [`logger.trace`](#loggertrace)
    - [`logger.addToContext`](#loggeraddtocontext)
    - [`logger.child`](#loggerchild)
  - [`RootLogger`](#rootlogger)
    - [`rootLogger.setLevel`](#rootloggersetlevel)
    - [`rootLogger.getLevel`](#rootloggergetlevel)
- [CLI](#cli)
- [Links](#links)
  - [Videos](#videos)
- [Development](#development)
  - [Overview](#overview)
  - [Testing](#testing)
  - [Working With Example Apps via Linking](#working-with-example-apps-via-linking)
  - [Working with create command](#working-with-create-command)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<br>

# Tutorial

1. For this tutorial we will use Prisma with PostgreSQL. Install PostgreSQL if needed and then get its connection URL. Check out [our postgresql setup guide](#setup-a-local-postgresql) if unsure.

1. Kick off a new project. Say yes (`y`) to the prisma option. Choose `PostgreSQL` for the db option.

   ```
   $ npx graphql-santa
   ```

1. Our Hello World schema doesn't account for information about moons, lets change that.

   Start by updating our data layer to model information about moons. We don't want to go crazy scientific here but a bit of modelling will serve us well. A world may have more than one moon, and a moon may have properites in its own right. So lets give moons a first class model representation. Then, we can connect them to their respective worlds:

   ```diff
   +++ prisma/schema.prisma
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

   `graphql-santa` reacts to changes in your Prisma schema. By saving the above, your dev database will be automatically migrated and photon regenerated. You literally now just move on to updating your GraphQL API.

1. We have data about `Earth` from before, but now we need to update it with information about its moon. Instead of working with photon inside one-off scripts, lets enhance our API and make the update as if a client app were.

   We're going to need to expose the `moons` world field to clients

   ```diff
   +++ src/schema.ts
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
    Warning: in /Users/jasonkuhrt/foobar/src/schema.ts:10:13

      6 definition(t) {
      7 t.model.id();
      8 t.model.name();
      9 t.model.population();
    → 10 t.model.moons();
   ```

   The feedback is pretty clear already but to restate: The problem is that we're project a Prisma model field (`moons`) that is a connection to another Prisma model (`Moon`) that has not been projected on our API layer. So let's do that now:

   ```diff
   +++ src/schema.ts
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
   +++ src/schema.ts
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

1. Deploy to Heroku

   For this step, create an account at [Heroku](https://www.heroku.com/) and [setup the CLI](https://devcenter.heroku.com/articles/heroku-cli).

   1. Create a new app: `heroku apps:create`
   1. Attach your project to the app: `heroku git:remote --app <app-name>`
   1. Add a postgres database to it: `heroku addons:create heroku-postgresql --app <app-name>`
   1. Get the postgres database credentials: `heroku pg:credentials:url --app <app-name>`
   1. Export the connection URL into your shell `export DATABASE_URL="<connection-url>"`
   1. Initialize the postgres database: `npx graphql-santa db init`
   1. Deploy using the git push to master workflow. See your app running in the cloud!

1. Conclusion

   Hopefully that gives you a taste of the power under your finger tips. There's a ton more to discover. Happy coding! 🙌

<br>

# Recipes

### Add Prisma

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `graphql-santa` makes it easy to integrate Prisma Framework into your app.

1. Install the prisma plugin

   ```
   $ npm install graphql-santa-plugin-prisma
   ```

1. Add a `schema.prisma` file. Add a datasource. Here we're working with SQLite. Add photon.

   ```diff
   +++ prisma/schema.prisma
   +
   +  datasource db {
   +    provider = "sqlite"
   +    url      = "file:dev.db"
   +  }
   +
   +  generator photonjs {
   +    provider = "photonjs"
   +  }
   ```

1. Initialize your database

   ```
   $ npx santa db init
   ```

1. Done. Now your app has:

   1. Functioning `$ santa db`
   2. `nexus-prisma` Nexus plugin allowing e.g.:

      ```diff
      +++ src/schema.ts
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

   3. An instance of the generated Photon.JS client is a added to context under `photon` property, allowing e.g.:

      ```diff
      +++ src/schema.ts
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

   4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

<br>

### Setup a local PostgreSQL

The reccommended way to run postgres locally is with docker, because it is easy flexible and reliable.

1. Start a postgres server for your app:

   ```
   docker run --detach --publish 5432:5432 --name 'postgres' postgres
   ```

2. Now you can use a connection URL like:

   ```
   postgresql://postgres:postgres@localhost:5432/myapp
   ```

If you don't want to use a docker, here are some links to alternative approaches:

- [With Homebrew](https://wiki.postgresql.org/wiki/Homebrew)

### Go to proudction

1. Add a build script

   ```diff
   +++ package.json
   + "build": "santa build"
   ```

2. Add a start script

   ```diff
   +++ package.json
   + "start": "node node_modules/.build"
   ```

3. In many cases this will be enough. Many deployment platforms will call into these scripts by default. You can customize where `build` outputs to if your deployment platform requires it. There are built in guides for `zeit` and `heroku` which will check your project is prepared for deployment to those respective platforms. Take advantage of them if applicable:

   ```diff
   +++ package.json
   + "build": "santa build --deployment now"
   ```

   ```diff
   +++ package.json
   + "build": "santa build --deployment heroku"
   ```

### Go to production with Prisma, Heroku, Heroku PostgreSQL

1. Confirm the name of the environment variable that Heroku will inject into your app at runtime for the database connection URL. In a simple setup, with a single attached atabase, it is `DATABASE_URL`.
1. Update your Prisma Schema file to get the database connection URL from an environment variable of the same name as in step 1. Example:

   ```diff
   --- prisma/schema.prisma
   +++ prisma/schema.prisma
     datasource postgresql {
       provider = "postgresql"
   -   url      = "postgresql://<user>:<pass>@localhost:5432/<db-name>"
   +   url      = env("DATABASE_URL")
     }
   ```

1. Update your local development environment to pass the local development database connection URL via an environment variable of the same name as in step 1. Example with [direnv](https://direnv.net/):

   1. Install `direnv`

      ```
      $ brew install direnv
      ```

   1. Hook `direnv` into your shell ([instructions](https://direnv.net/docs/hook.html))
   1. Setup an `.envrc` file inside your project

      ```diff
      +++ .envrc
      + DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"
      ```

   1. Approve the `.envrc` file (one time, every time the envrc file changes).
      ```
      $ direnv allow .
      ```
   1. Done. Now when you work within your project with a shell, all your commands will be run with access to the environment variables defined in your `.envrc` file. The magic of `direnv` is that these environment variables are automatically exported to and removed from your environment based on you being within your prject directory or not.

<br>

# Conventions

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

This module is optional **when** you just have schema modules and so graphql-santa already knows how import them into the final build. Otherwise you'll need this module to import your custom modules etc.

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
src/
  server.ts
  schema.ts
prisma/
  schema.prisma
```

<br>

# API

## `app`

A singleton graphql-santa app. Use this to build up your GraphQL schema and configure your server.

**Example**

```ts
// schema.ts

import { app } from 'graphql-santa'

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

import { app } from 'graphql-santa'

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

import { app } from 'graphql-santa'

app.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

### `app.logger`

An instance of [`RootLogger`](#rootlogger).

**Example**

```ts
// app.ts

import { app } from 'graphql-santa'

app.logger.info('boot')
```

### `app.server`

An instance of [`Server`](#server).

Framework Notes:

- If your app does not call `app.server.start` then `santa` will. It is idiomatic to allow `santa` to take care of this. If you deviate, we would love to learn about your use-case!

<br>

## `Server`

TODO

### `server.start`

### `serve.stop`

<br>

## `Logger`

TODO

### `.create`

### `logger.fatal`

### `logger.error`

### `logger.warn`

### `logger.info`

### `logger.debug`

### `logger.trace`

### `logger.addToContext`

### `logger.child`

<br>

## `RootLogger`

TODO

Extends [`Logger`](#logger)

### `rootLogger.setLevel`

### `rootLogger.getLevel`

### `rootLogger.setPretty`

### `rootLogger.isPretty`

<br>

# CLI

```
$ santa --help
```

# Links

### Videos

GraphQL Santa Development Series

- [GraphQL Santa #1 - Hello World](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

Talks

- on 2019/12/10 | by [Flavian Desverne](https://github.com/Weakky) | [GraphQL Berlin Meetup #16: Boosting backend development productivity](https://www.youtube.com/watch?v=AqQEfFXxZKo)

<br>

# Development

### Overview

```
yarn
yarn test
yarn dev
```

<br>

### Website

We currently use [docsifyjs/docsify](https://github.com/docsifyjs/docsify). We deploy to `gh-pages`.

#### Getting started

1. Install `docsify-cli`

   There is currently [a bug](https://github.com/docsifyjs/docsify-cli/issues/88) with `docsify-cli` requiring the following manual fix after installation. To make this less painful, install globally so you should only have to do this once.

   ```
   yarn global add docsify
   ```

   ```
   vim /usr/local/bin/docsify
   :se ff=unix
   :wq
   ```

2. Boot docs dev to preview your changes locally

   ```
   yarn docs:dev
   ```

#### Notes

- There is no build step
- Commits to master will trigger deployment (via `gh-pages`, no ci/cd on our part)

<br>

### Testing

Integration tests rely on `npm link`. This means those integration tests cannot
work on a machine that has not done `npm link` inside the root of the cloned
repo.

The reason we do not use `yarn link` is that yarn [does not symlink the bin into
local node_modules](https://github.com/yarnpkg/yarn/issues/5713).

### Working With Example Apps via Linking

Refer to https://github.com/prisma-labs/graphql-santa-examples

### Working with create command

In any example you can use this workflow:

```
rm -rf test-create && mcd test-create && ../node_modules/.bin/graphql-santa create
```
