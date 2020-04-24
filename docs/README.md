# Introduction {docsify-ignore}

<p class='NextIs Note'></p>

Nexus is a delightful framework for building GraphQL APIs in Node. It leverages TypeScript and knowledge about your data sources and API schema to give you levels of type safety that until now you've probably never experienced.

### Features

- Pervasive zero-config philosophy.
- You are free to use the API where and how you see fit. Few conventions on how to structure your app.
- GraphQL schema construction
  - Define your schema in code, abstract repeated patterns.
  - Integrated helpers for building Relay compliant pagination
  - Define graphql types without export/import and configuration boilerplate.
- Type safety made simple
  - Automatically fully typed GraphQL resolvers accounting for what you see in the `parent`, `args`, `ctx` arguments and what you're allowed to return.
  - Automatically extracted types from return values in your `addToContext` invocations are merged into the Nexus resolver context type.
  - Export any type in any module to make it available as a backing type for any object in your GraphQL schema.
- Integrated logger component built atop Pino
  - Pretty mode for development
  - JSON mode for production
  - Automatic request-scoped child logger available on context object
- Integrated Testing
  - Utils to boot a test app, integrated GraphQL client ready to make requests against it
- Sane defaults
  - Top-level sync and async error handling, process exit
- Scaffolding
  - Generate new app projects
  - Generate new plugin projects
- Plugins
  - build hooks
  - dev hooks
  - resolver middleware
  - add type defs
  - add field def builders
  - add type def builders
- Generate GraphQL SDL from your schema, make pull-request reviews more collaborative.
- Integrated TypeScript
  - No install needed
  - Builtin dynamic tsconfig guide rails
  - Nexus CLI honurs your tsconfig
- Simple dependency management
  - One dep
  - Add prisma, only one dep more
  - Nexus handles sound integration between all components
- Decomposable, from framework to libs
  - @nexus/schema
  - @nexus/logger

### Future Features

- Integrated query complexity analysis
- Integrated Bundler
  - Automatically tree shake your app into the minimum artifact size
  - Automatically generate v8 snapshots for ultimate cold start times
- Integrated Server
  - Platform adaptors providing fully typed request and response objects
  - Seamless transition between serverful and serverless
  - Pluggable
- Integrated Ops
  - Deployment adaptors (Now, AWS Lambda, Google Functions)
  - Adaptors for logging and APM (Elastic, Datadog, New Relic, ...)
  - Alpine Docker images
  - Pluggable
- ...

### Limitations

We plan to lift these limitations one day.

- Lacks good Windows support [issues](https://github.com/graphql-nexus/nexus/labels/platform%2Fwindows)
- Does not work with JavaScript [#85](https://github.com/graphql-nexus/nexus/issues/85)
- Does not cover the entire GrpahQL Spec
  - Subscriptions [#447](https://github.com/graphql-nexus/nexus/issues/447)
  - Interface Extensions [#713](https://github.com/graphql-nexus/nexus/issues/713])

### Non-Goals

We do not plan to lift these limitations.

- Works with Node v9 and below
