Versions of the `nexus` package below `0.20` were what is now known as `@nexus/schema`. This transition of the `nexus` package from being a schema library to a framework was announced [in this GitHub issue](https://github.com/prisma-labs/nexus/issues/373). The following receipe shows how to migrate from nexus schema `0.12` to the latest version of Nexus framework.

#### Dependencies

1. Remove `nexus@0.12` and add `nexus@0.20` (or higher) in its place.
1. Remove dependency `graphql` as `nexus` bundles it.

```diff
+++ package.json
   "dependencies": {
-     "graphql": "...",
-     "nexus": "0.12.0",
+     "nexus": "next"
   }
```

#### Project Layout

Not much to do but your source must include a `graphql` module or directory, and/or `app` entrypoint. More details in the [convention guide](/guides/project-layout#conventions). Nexus will give informative feedback if you get this wrong.

#### Type Defs (aka. schema)

Nexus is based upon a singleton system. Import the `schema` component to get access to the nexus building blocks you're familiar with. But unlike before you will no longer need to export/import the type defs for passing into `makeSchema`. All of that is handled for you. To aid in this style of project code the framework has a convention that all `graphql` modules or child modules of `graphql` directories get auto-imported. Example:

```diff
+++--- graphql/user.ts
- import { objectType } from 'nexus'
+ import { schema } from 'nexus'

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

- const schema = makeSchema({ types: [User] })
...
```

#### Context

Nexus has an API for adding to context.

```diff
+++ app.ts
+ import { schema } from 'nexus'

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

The server migration is particularly dependent on your setup. Nexus bundles `express` and `express-graphql`.

If you are not doing any or much custom server logic you can get away with not dealing with the server at all. Just delete all code, Nexus will handle it for you.

```diff
--- app.ts
- import express from 'express'
- import { GraphQLServer } from 'graphql-yoga'

- const server = new GraphQLServer({ schema: ... })
- server.start()
```

If you do have server logic that needs porting, and it is express based, use `server.express`:

```diff
--- app.ts
+ import { server } from 'nexus'

+ server.express.use(...)
```

We currently do not support any other server than `express`.

#### Developing & Building

You should only be working with the `nexus` CLI. Below shows the example scripts you might have had previously, versus what you'll now have (suggested).

```diff
---+++package.json
  "scripts": {
-    "start": "node dist/server",
-    "clean": "rm -rf dist",
-    "build": "npm -s run clean && npm -s run generate && tsc",
-    "generate": "npm -s run generate:prisma && npm -s run generate:nexus",
-    "generate:prisma": "prisma generate",
-    "generate:nexus": "ts-node --transpile-only src/schema",
-    "postinstall": "npm -s run generate",
-    "dev": "ts-node-dev --no-notify --respawn --transpileOnly src/server",
+    "dev": "nexus dev",
+    "build": "nexus build",
+    "start": "node .nexus/build"
  },
```

#### Backing Types

With Nexus Schema you manage backing types for your GraphQL objects centrally via `makeSchema`. Paths you give are to modules that export types. Type names that _match your GraphQL object type names_ are made their respective backing types.

With Nexus Framework backing types are handled as follows:

1. You export TypeScript types in any module
2. You configure your object type configs to use any of these exported TypeScript types.

For more detail about backing types and how they work in Nexus Framework, see the [backing types section in the schema guide](/guides/schema#backing-types-in-nexus)

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
import { schema } from 'nexus'

export type A = {
  /* ... */
}

schema.objectType({
  rootTyping: 'A',
  // ...
})
```

#### Nullability

By default Nexus Schema has [outputs as guaranteed](https://nexus.js.org/docs/getting-started#nullability-default-values). Nexus Framework has outputs as nullable.

- If you rely heavily on the Nexus Schema defaults then please wait for [#483](https://github.com/graphql-nexus/nexus/issues/483) so that you can turn them back on that way in the framework.
- If you use the following settings in your app currently then you can migrate seamlessly to Nexus framework, since this config is now the default:

  ```ts
  makeSchema({
    nonNullDefaults: {
      input: false,
      output: false,
    },
  })
  ```

#### Logging

Nexus ships with its own logger.

```diff
import { log } from 'nexus'

- console.log('hello world! %j', { population: 6_000_000 })
+ log.info('hello world!', { population: 6_000_000 })
```

#### Prisma

If you were a [`nexus-prisma`](https://github.com/prisma-labs/nexus-prisma) user, you will now become a [`nexus-plugin-prisma`](https://github.com/graphql-nexus/plugin-prisma) user. Install the plugin, and enable it in your project.

```diff
---+++package.json
  dependencies: {
-   "nexus-prisma": "...",
-   "@prisma/client": "...",
-   "@prisma/cli": "..."
+   "nexus-plugin-prisma": "...",
```

```diff
---+++app.ts
- import { nexusPrismaPlugin } from 'nexus-prisma'

- makeSchema({
-   plugins: [nexusPrismaPlugin()],

+ import { use } from 'nexus'
+ import { prisma } from 'nexus-plugin-prisma'

+ use(prisma())
```

You should still use the Prisma CLI. Only `$ prisma generate` will be taken care of for you.
