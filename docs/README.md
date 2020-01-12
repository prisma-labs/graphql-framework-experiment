# Introduction

`graphql-santa` (henceforth referred to as `santa`) is a framework for building GraphQL APIs in Node.

Here are some of the things `santa` cares about:

- Delightful developer experience
- A CLI supporting devlopment lifecycle workflows
- A deep plugin system for both runtime and CLI
- Type-Safety across your entire codebase
- Runtime performance
- Integration Testing

Here is what hello world looks like:

```ts
import { app } from 'graphql-santa'

app.queryType({
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

app.objectType({
  name: 'World',
  definition(t) {
    t.string('name')
    t.integer('population')
  },
})
```

Here is a brief overview of some of the components that `santa` is made up of:

- **HTTP Server**  
  This component handles recieving requests and sending responses to your clients. It is the transport layer, which GraphQL itself is actually agnostic about. `santa` has features that make it so most apps won't need to deal with this component directly.

  We currently use [Express](https://github.com/expressjs/express) and [Apollo Server](https://github.com/apollographql/apollo-server) but note there is an [open issue](https://github.com/prisma-labs/graphql-santa/issues/231) about adopting [`fastify-gql`](https://github.com/mcollina/fastify-gql) instead.

- **GraphQL Schema**  
  This is where you model your domain, all the data that your API will accept and return, and all the various objects in the domain relate to one another (the graph part of "GraphQL").

  We use (and contribute to) [nexus](https://github.com/prisma-labs/nexus).

- **Logger**  
  One of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. Also a workhorse of debugging and providing feedback during development.

  We have our own logger but write to [`pino`](https://github.com/pinojs/pino) under the hood for its performance.

- **CLI**  
  Your entrypoint for running dev mode, builds, linting, and more.

- **Builder**  
  The part where you build your app into something ready for deployment to production.

  We use [TypeScript](https://github.com/microsoft/TypeScript). We [plan](https://github.com/prisma-labs/graphql-santa/issues/119) to introduce a bundle step as well.

### Videos

_Development Series_

- [GraphQL Santa #1 - Hello World](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

  [![image](https://user-images.githubusercontent.com/284476/71212025-786f3880-227e-11ea-9dee-467239d46993.png)](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

_Talks_

- on 2019/12/10 | by [Flavian Desverne](https://github.com/Weakky) | [GraphQL Berlin Meetup #16: Boosting backend development productivity](https://www.youtube.com/watch?v=AqQEfFXxZKo)
