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

Not much to do but your source must include a `graphql` module or directory, and/or `app`/`server`/`service` entrypoint. More details in the [convention docs](/getting-started/project-structure). Nexus will give informative feedback if you get this wrong.

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

If you are using a server other than express use `server.custom` but return your own implementation. Example for fastify-gql (see complete example app [here](https://github.com/graphql-nexus/examples/tree/master/custom-server-fastify-gql)):

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

##### Backing Types

With Nexus Schema backing types are handled as follows:

- You co-locate TypeScript typings as strings with your object type configs
- Or you centrally configure typings with `makeSchema`. Paths you give are to modules that export types. Type names that _match your GraphQL object type names_ are made their respective backing types.

With Nexus Framework backing types are handled as follows:

1. You export TypeScript types in any module
2. You configure your object type configs to use any of these exported TypeScript types.

**Example**

_before_

```ts
// some-module.ts
export type A = {
  /* ... */
}
```

```ts
// schema.ts
export const A = objectType({
  name: 'A',
  // ...
})
```

```ts
// main.ts
// ...
const schema = makeSchema({
  typegenAutoConfig: [
    {
      source: path.join(__dirname, 'some-module.ts'),
      alias: 'SomeModule',
    },
  ],
  // ...
})
// ...
```

_after_

```ts
import { schema } from 'nexus-future'

export type A = {
  /* ... */
}

schema.objectType({
  rootTyping: 'A',
  // ...
})
```

##### Nullability

By default Nexus Schema has [outputs as guaranteed](https://nexus.js.org/docs/getting-started#nullability-default-values). Nexus Framework has outputs as nullable.

- If you rely heavily on the Nexus Schema defaults then please wait for [#483](https://github.com/graphql-nexus/nexus-future/issues/483) so that you can turn them back on that way in the framework.
- If you use the following settings in your app currently then you can migrate seamlessly to Nexus framework, since this config is now the default:

  ```ts
  makeSchema({
    nonNullDefaults: {
      input: false,
      output: false,
    },
  })
  ```

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

You will not use the `prisma2` CLI anymore. `$ prisma2 generate` will be taken
care of for you. `$ prisma2 migrate` features will be made available under `$ nexus db ...`.
