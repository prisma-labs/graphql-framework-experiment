# Server

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fserver) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+)

Use this to run your HTTP server that clients will connect to. The default server is an instance of [`express-graphql`](https://github.com/graphql/express-graphql).

### `start`

Make the server start listening for incoming client connections.

Calling start while already started is a no-op.

Normally you should not need to use this method. When your app does not call `server.start`, Nexus will do so for you automatically.

### `stop`

Make the server stop listening for incoming client connections.

Calling stop while the server is already stopped is a no-op.

Normally you should not need to use this method.

### `custom`

Augment or replace the default server implentation.

**Signature**

<!-- prettier-ignore -->
```ts
(
  customizerLens: {
    express: Express,
    schema:  GraphQLSchema,
    context: ContextCreator
  }
) => MaybePromise<void | ServerReplacement>
```

- param `customizerLens`

  Useful for Augmentation:

  - `express` – A reference to the Express [`App`](http://expressjs.com/en/4x/api.html#app) instance. Accessing this property will trigger express app instantiation. Avoid this if you are intending to _replace_ the server implementation completely. Lazy instantiation is used so that that your app does not pay an express app performance penalty if you are not using it.

  Useful for Replacement:

  - `schema` – An instance of [GraphQLSchema](https://graphql.org/graphql-js/type/#graphqlschema) from `graphql` package. The result of `makeSchema` from `@nexus/schema`.

  - `context` – The context creator for the app. This is a bundle of all the app's (`addToContext`) and plugins' context contributions. If you are replacing the server, you must invoke this function on every incoming request with the request object, and then thread the returned context data to your resolver execution. If you are using a high level server library like `apollo-server` or `fastify-gql` then all you should have to do is pass this function along to them (see example below).

    > Warning [#424](https://github.com/graphql-nexus/nexus-future/issues/424)  
    > Currently, context contributors work directly against the Express [Request object](http://expressjs.com/en/4x/api.html#req). This means if your custom implementation calls the context creator with an incompatible request object, they context contributors may encounter runtime errors.

* return `void` – This means the default implementation, an express server, will be used. Presumably you are just accessing the `express` property and augmenting the express instance.

* return `ServerReplacement` – This means the default implementation, an express server, will be replaced. You need only teach Nexus how to start and stop your custom server. Refer to docs `server.start` and `sever.stop` for what you must provide.

* return `Promise<void | ServerRepalcement>` – If you need to do async work.

**Example of augmenting the Express server ([Repo](https://github.com/prisma-labs/nexus-future-examples/tree/master/custom-server))**

```ts
import cors from 'cors'
import { server } from 'nexus-future'

server.custom(({ express }) => {
  express.use(cors())
})
```

**Example of replacing the express server with another ([Repo](https://github.com/prisma-labs/nexus-future-examples/tree/master/custom-server-fastify-gql))**

```ts
import Fastify, { FastifyRequest } from 'fastify'
import FastifyGQL from 'fastify-gql'
import { schema, server, settings, log } from 'nexus-future'

server.custom(({ schema, context }) => {
  const app = Fastify()

  app.register(FastifyGQL, {
    schema,
    context,
    ide: 'playground',
  })

  return {
    async start() {
      await app.listen(settings.current.server.port)

      log.info(`listening`, {
        initialConfig: app.initialConfig,
        url: `http://localhost:${settings.current.server.port}/playground`,
      })
    },
    stop() {
      return app.close()
    },
  }
})

schema.addToContext<FastifyRequest>(_req => {
  return {
    db: {
      users: {
        newton: {
          id: '1',
          birthyear: '1649',
          name: 'Newton',
        },
      },
    },
  }
})
```
