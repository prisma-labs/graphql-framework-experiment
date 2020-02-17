## HTTP Server

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fserver) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+))

### About {docsify-ignore}

This component handles recieving requests and sending responses to your clients. It is the transport layer, which GraphQL itself is actually agnostic about. Simple apps will not need to deal with this component directly as Nexus automatically runs it by default.

We currently use [`express-graphql`](https://github.com/graphql/express-graphql). There is an [open issue](https://github.com/graphql-nexus/nexus-future/issues/231) about adopting [`fastify-gql`](https://github.com/mcollina/fastify-gql) instead.

### Features {docsify-ignore}

TODO

## GraphQL Schema

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fgql) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Fbug+))

### About {docsify-ignore}

This is where you model your domain, all the data that your API will accept and return, and all the various objects in the domain relate to one another (the graph part of "GraphQL").

We use (and contribute to) [nexus](https://github.com/prisma-labs/nexus).

### Features {docsify-ignore}

TODO

## Builder

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fbuilder) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fbuilder+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fbuilder+label%3Atype%2Fbug+))

### About {docsify-ignore}

The part where you build your app into something ready for deployment to production.

We use [TypeScript](https://github.com/microsoft/TypeScript). We [plan](https://github.com/graphql-nexus/nexus-future/issues/119) to introduce a bundle step as well.

### Features {docsify-ignore}

TODO

## Database

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fdatabase) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fdatabase+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fdatabase+label%3Atype%2Fbug+))

### About {docsify-ignore}

Many applications need to persist data, but doing so often brings on more complexity. Deployments are harder, accurate local development environments are more involved, integration tests become more complex to write and slower, ... and so on. Nexus tackles this complexity by standardizing a database driver system that makes it possible to integrate database workflows seamlessly into your project.

### Features {docsify-ignore}

- CLI workflows TODO
- TestContext integration TODO

## Dev

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fdev) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fdev+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fdev+label%3Atype%2Fbug+))

### About {docsify-ignore}

In development you want a variety of features that make it easy to work on and try ideas. An easy way to boot your app, perhaps useful debug features enabled, pretty logs, quick server restarts on source changes, maybe a local database, and so on.

### Features {docsify-ignore}

- Pluggable
- Reboot server on source change
- Handles TypeScript compilation
- Handles Nexus typegen

## Logger

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Flogger) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Fbug+))

### About {docsify-ignore}

One of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. A classic workhorse of debugging and development time feedback. There are a wealth of specialized tools but a great logging strategy can take you far. Nexus gives you a logging system built for a modern cloud native environment.

We have our own logger but write to [`pino`](https://github.com/pinojs/pino) under the hood for its performance.

### Features {docsify-ignore}

- Uses a beautiful pretty mode during development  
  **_why_** JSON is appropiate for machines but less so for humans.

  **_example_**

  ```
  ● info  nexus:dev:boot
  ● info  app:boot

  ------------
  LOGGING DEMO
  ------------
  ✕ fatal app:foo  --  lib: /see/
  ■ error app:foo  --  har: [object Object]
  ▲ warn  app:foo  --  bleep: 1,2,true
  ● info  app:foo
  ○ debug app:foo  --  foo: bar
  — trace app:foo  --  a: 1  b: 2  c: three
  ------------

  ● info  app:server:listening  --  host: localhost  port: 4000
  ```

- Outputs newline-delimited JSON ([NDJSON](http://ndjson.org/)) <br>
  **_why_** A natural format for most any cloud-native logging platform.

  **_example_**

  ```
  {"level":30,"time":1578887817230,"pid":30997,"hostname":"Jasons-Prisma-Machine.local","path":["nexus","dev"],"context":{},"event":"boot","v":1}
  {"level":30,"time":1578887819619,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{},"event":"boot","v":1}
  {"level":60,"time":1578887819621,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"lib":{}},"event":"foo","v":1}
  {"level":50,"time":1578887819621,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"har":{"mar":"tek"}},"event":"foo","v":1}
  {"level":40,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"bleep":[1,"2",true]},"event":"foo","v":1}
  {"level":30,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{},"event":"foo","v":1}
  {"level":20,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"foo":"bar"},"event":"foo","v":1}
  {"level":10,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"a":1,"b":2,"c":"three"},"event":"foo","v":1}
  {"level":30,"time":1578887819645,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app","server"],"context":{"host":"localhost","port":4000},"event":"listening","v":1}
  ```

* Event oriented API, JSON schema, and pretty mode  
  **_why_** Thinking of logs as events and keeping contextual information as structured data rather than interpolated into strings empowers your downstream to do more. For example better filtering in development mode and better aggregations in production in your logging platform.

* Request logger instances  
  **_why_** These enable you to attach contextual information such as user IDs or trace IDs that subsequent logs in the request lifecycle will maintain. In turn this helps you reason about your logs in your logging platform later: group by user id, isolate all activity of a single request, and so on.

* Standardizes six log levels: `fatal` `error` `warn` `info` `debug` `trace`  
  **_why_** Give logs more meaning/semantics, helps enable alerting policies, enables keeping production logs lean whilst maintaining higher resolution for development in development.

* (_will ↣_ [#263](https://github.com/graphql-nexus/nexus-future/issues/263)) Exposes the pretty renderer as a CLI  
  **_why_** Allows you to pipe JSON logs from a remote location thus maintaining the human-readable experience you get in development.

* (_will ↣_ [#265](https://github.com/graphql-nexus/nexus-future/issues/265)) Integrates logs from [`debug`](https://github.com/visionmedia/debug)  
  **_why_** We make it possible to continue benefiting from the widespread use of this tool in the node community in our structured system.

* (_will ↣_ [#264](https://github.com/graphql-nexus/nexus-future/issues/264)) Interactive filtering on the command line  
  **_why_** Keep yourself in the flow by focusing on the logs most relevant to your current development loop; Enjoy `trace` level without an overwhelming firehose; Enjoy isolating your or someone else's plugin logs.

## CLI

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fcli) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fcli+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fcli+label%3Atype%2Fbug+))

### About {docsify-ignore}

Your entrypoint for running dev mode, builds, linting, and more.

### Features {docsify-ignore}

TODO

## Plugins

[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fplugins) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Fbug+))

### About {docsify-ignore}

TODO

### Features {docsify-ignore}

TODO
