## Migrate from Nexus schema

Versions of the `nexus` package `0.20` and below were what is now known as `@nexus/schema`. This transition of the `nexus` package from being a schema library to a framework was announced [in this GitHub issue](https://github.com/prisma-labs/nexus/issues/373). The following receipe shows how to migrate from nexus schema `0.12` to the latest version of Nexus framework.

> As of right now the transition is still taking place and the package to install is `nexus-future`. That will soon become `nexus` and as soon as it does this this migration guide will be updated to reflect it.

#### Dependencies

1. Remove `nexus@0.12` and add `nexus-future` in its place. There is a `next` dist tag if you want every change as it lands on trunk (aka. master).
1. Remove dependency `graphql` as `nexus-future` bundles it.

```diff
+++ package.json
   "dependencies": {
-     "graphql": "...",
-     "nexus": "...",
+     "nexus-future": "..."
   }
```

#### Project Layout

Not much to do but your source must include a `graphql` module or directory, and/or `app`/`server`/`service` entrypoint. More details in the [convention docs](/references/conventions). Nexus will give informative feedback if you get this wrong.

#### Type Definitions (aka. schema)

Nexus is based upon a singleton system. Import the `schema` component to get access to the nexus building blocks you're familiar with. But unlike before you will no longer need to export/import the type defs for passing into `makeSchema`. All of that is handled for you. To aid in this style of project code the framework has a convention that all `graphql` modules or child modules of `graphql` directories get auto-imported. Example:

```diff
+++--- graphql/user.ts
- import { objectType } from 'nexus'
+ import { schema } from 'nexus-future'

- export const User = objectType({
+ schema.objectType({
   name: 'User',
   ...
})
```

```diff
--- main.ts
- import { User } from './graphql/user'
- import { makeSchema } from 'nexus'

- const schmea = makeSchema({ types: [User] })
...
```

#### Context

Nexus has an API for adding to context.

```diff
+++ app.ts
+ import { schema } from 'nexus-future'

+ schema.addToContext(req => {
+   return { ... }
+ })

- // Example
- import { GraphQLServer } from 'graphql-yoga'

- new GraphQLServer({
-    context(req) => {
-      return { ... }
-   }
- })
```

#### Server

The server migration is particularly dependent on your setup. Nexus bundles `express` and `express-graphql` but there is an escape hatch if you need it.

If you are not doing any or much custom server logic you can get away with not dealing with the server at all. Just delete all code.

```diff
--- app.ts
- import express from 'express'
- import { GraphQLServer } from 'graphql-yoga'

- const server = new GraphQLServer({ schema: ... })
- server.start()
```

If you do have server logic that needs porting, and it is express based, use `server.custom`:

```diff
--- app.ts
+ import { server } from 'nexus-future'

+ server.custom(({ express }) => {
+   express.use(...)
+   ...
+ })
```

If you are using a server other than express use `server.custom` but return your own implementation. Example for fastify-gql (see complete example app [here](https://github.com/prisma-labs/nexus-future-examples/tree/master/with-fastify-gql)):

```diff
+++ app.ts
+ server.custom(({ schema, context }) => {
+   const app = Fastify()
+
+   app.register(FastifyGQL, { schema, context })
+
+   return {
+     start() {
+       return app.listen(settings.current.server.port)
+     },
+     stop() {
+       return app.close()
+     }
+   }
+ })
```

#### Developing & Building

You should only be working with the `nexus` CLI. Below shows the example scripts you might have had previously, versus what you'll now have (suggested).

```diff
---+++package.json
  "scripts": {
-    "start": "node dist/server",
-    "clean": "rm -rf dist",
-    "build": "npm -s run clean && npm -s run generate && tsc",
-    "generate": "npm -s run generate:prisma && npm -s run generate:nexus",
-    "generate:prisma": "prisma2 generate",
-    "generate:nexus": "ts-node --transpile-only src/schema",
-    "postinstall": "npm -s run generate",
-    "dev": "ts-node-dev --no-notify --respawn --transpileOnly src/server",
+    "dev": "nexus dev",
+    "build": "nexus build",
+    "start": "node node_modules/.build"
  },
```

#### Other Details

##### Logging

Nexus ships with its own logger.

```diff
import { log } from 'nexus-future'

- console.log('hello world! %j', { population: 6_000_000 })
+ log.info('hello world!', { population: 6_000_000 })
```

##### Prisma

If you were a [`nexus-prisma`](https://github.com/prisma-labs/nexus-prisma) user, you will now become a [`nexus-plugin-prisma`](https://github.com/graphql-nexus/plugin-prisma) user.

The Nexus plugin system has an auto-use feature. It means once you've installed your Nexus plugin you're done, your app will already use it at runtime.

```diff
---+++package.json
  dependencies: {
-   "nexus-prisma": "...",
-   "@prisma/client": "...",
+   "nexus-plugin-prisma": "...",
```

```diff
---app.ts
- import { nexusPrismaPlugin } from 'nexus-prisma'

- makeSchema({
-   plugins: [nexusPrismaPlugin()],
```

You will not use the `prisma2` CLI anymore. `$ prisma2 generaate` will be taken care of for you. `$ prisma2 migrate` features will be made available under `$ nexus db ...`.

## Use Prisma

1. Install the prisma plugin

   ```cli
   npm install nexus-plugin-prisma
   ```

1. Add a `schema.prisma` file. Add a datasource. Here we're working with SQLite. Add Prisma Client.

   ```diff
   +++ prisma/schema.prisma
   +
   +  datasource db {
   +    provider = "sqlite"
   +    url      = "file:dev.db"
   +  }
   +
   +  generator prisma_client {
   +    provider = "prisma-client-js"
   +  }
   ```

1. Initialize your database

   ```cli
   npx nexus db init
   ```

1. Done. Now your app has:

   1. Functioning `db` command

      ```cli
      nexus db
      ```

   1. `nexus-prisma` Nexus plugin allowing e.g.:

      ```diff
      +++ src/graphql.ts
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

   1. An instance of the generated Prisma Client is a added to context under the `db` property, allowing e.g.:

      ```diff
      +++ src/graphql.ts
        queryType({
          definition(t) {
            t.list.field('users', {
              type: 'User',
      -       resolve() {
      -         return [{ id: '1643', name: 'newton' }]
      +       resolve(_root, _args, ctx) {
      +         return ctx.db.users.findMany()
              },
            })
          },
        })
      ```

   1. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

## Create a Consumable Plugin

1. Scaffold Your plugin project

   ```cli
   npx nexus-future create plugin
   ```

2. Publish it

   ```cli
   yarn publish
   ```

## Local PostgreSQL

The reccommended way to run postgres locally is with docker, because it is easy flexible and reliable.

1. Start a postgres server for your app:

   ```cli
   docker run --detach --publish 5432:5432 --name 'postgres' postgres
   ```

2. Now you can use a connection URL like:

   ```
   postgresql://postgres:postgres@localhost:5432/myapp
   ```

If you don't want to use a docker, here are some links to alternative approaches:

- [With Homebrew](https://wiki.postgresql.org/wiki/Homebrew)

## Go to proudction

1. Add a build script

   ```diff
   +++ package.json
   + "build": "nexus build"
   ```

2. Add a start script

   ```diff
   +++ package.json
   + "start": "node node_modules/.build"
   ```

3. In many cases this will be enough. Many deployment platforms will call into these scripts by default. You can customize where `build` outputs to if your deployment platform requires it. There are built in guides for `zeit` and `heroku` which will check your project is prepared for deployment to those respective platforms. Take advantage of them if applicable:

   ```diff
   +++ package.json
   + "build": "nexus build --deployment now"
   ```

   ```diff
   +++ package.json
   + "build": "nexus build --deployment heroku"
   ```

## Prisma + Heroku + PostgreSQL

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

      ```cli
      brew install direnv
      ```

   1. Hook `direnv` into your shell ([instructions](https://direnv.net/docs/hook.html))
   1. Setup an `.envrc` file inside your project

      ```diff
      +++ .envrc
      + DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"
      ```

   1. Approve the `.envrc` file (one time, every time the envrc file changes).
      ```cli
      direnv allow .
      ```
   1. Done. Now when you work within your project with a shell, all your commands will be run with access to the environment variables defined in your `.envrc` file. The magic of `direnv` is that these environment variables are automatically exported to and removed from your environment based on you being within your prject directory or not.

## Integrate `createTestContext` with `jest`

1. Wrap `createTestContext` so that it is integrated with the `jest` test suite lifecycle hooks:

   ```ts
   // tests/__helpers.ts
   import { createTestContext, TestContext } from 'nexus-future/testing'

   export function createTestContext(): TestContext {
     let ctx: TestContext

     beforeAll(async () => {
       ctx = await createTestContext()
       await ctx.app.server.start()
     })

     afterAll(async () => {
       await ctx.app.server.stop()
     })

     return ctx
   }
   ```

1. Import your wrapped version into all test suites needing it:

   ```ts
   // tests/foo.spec.ts
   import { createTestContext } from './__helpers'

   const ctx = createTestContext()

   it('foo', () => {
     // use `ctx` in here
   })
   ```

   Note that `ctx` is not usable outside of `jest` blocks (`it` `before` `after` `...`). If you try to you'll find it to be `undefined`.

   ```ts
   import { createTestContext } from './__helpers'

   const { app } = createTestContext() // Error!
   ```
