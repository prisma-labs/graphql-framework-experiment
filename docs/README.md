# Introduction {docsify-ignore}

> Nexus [schema](https://github.com/prisma-labs/nexus) is becoming the Nexus framework. Learn more about the transition in this [GitHub issue](https://github.com/prisma-labs/nexus/issues/373). Learn how to migrate your app in the [migration guide](/getting-started/migrate-from-nexus-schema).

Nexus is a framework for building GraphQL APIs in Node. It leverages TypeScript and the knowledge it has about your data sources and API schema to automatically enforce correctness on significant portions of your API implementation that traditionally require manual testing.

Nexus is batteries included. It has components to handle your server, logger, schema and configuration.

A minimal Nexus app looks like this:

```
|- graphql.ts
|- tsconfig.json
|- package.json
```

Just a regular TypeScript Node project with a `graphql.ts` module. You can define your API's GraphQL types in the `graphql.ts` module. Nexus will find and import them. Here's an example of what that might look like:

```ts
import { schema } from 'nexus-future'

schema.queryType({
  definition(t) {
    t.field('hello', {
      type: 'World',
      resolve() {
        return {
          name: 'Earth',
          population: 6_000_000,
        }
      },
    })
  },
})

schema.objectType({
  name: 'World',
  definition(t) {
    t.string('name')
    t.integer('population')
  },
})
```

A less trivial app might need to deal with multiple schema modules and server customization. Still minimal, that might look like:

```
|- api/graphql/blog.ts
|- api/graphql/user.ts
|- api/app.ts
|- tsconfig.json
|- package.json
```

Nexus will treat `app.ts` as your entrypoint and find all modules inside the `graphql` directory. Customizations in your `app` module might look like:

```ts
import { settings, server } from 'nexus-future'
import cors from 'cors'

settings.change({
  schema: {
    generateGraphQLSDLFile: 'api.graphql',
  },
})

server.custom(({ express }) => {
  express.use(cors())
})
```
