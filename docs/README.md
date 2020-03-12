# Introduction {docsify-ignore}

<p class='NextIs Note'></p>

> Nexus [schema](https://github.com/prisma-labs/nexus) is becoming the Nexus framework. Learn more about the transition in this [GitHub issue](https://github.com/prisma-labs/nexus/issues/373). Learn how to migrate your app in the [migration guide](/getting-started/migrate-from-nexus-schema).

Nexus is a delightful framework for building GraphQL APIs in Node. It leverages TypeScript and knowledge about your data sources and API schema to bring levels of type safety far beyond what other tools in Node can offer at near-zero complexity cost.

If you are new to GraphQL here are some resources you might find helpful:

- [Official GraphQL website](https://graphql.org)
- [How to GraphQL](https://www.howtographql.com)

If you are new to TypeScript here are some resources you might find helpful:

- [The New Handbook](https://microsoft.github.io/TypeScript-New-Handbook/everything/)
- [The Interactive Playground](http://www.typescriptlang.org/play)
- [Dozens of articles](https://mariusschulz.com/blog) by [Marius Schulz](https://github.com/mariusschulz)
- [Dozens of articles](https://2ality.com/index.html) by [Dr. Axel Rauschmayer](https://github.com/rauschma)

If you would like to jump straight into code here are some things you might find useful to do:

- Start new project by running `npx nexus-future`
- Peruse our [examples repo](https://github.com/graphql-nexus/examples)

## What

Nexus is a sophisticated tool built of multiple components that broadly fall into three categories: runtime, worktime, testtime.

_worktime_

The worktime component is a command line interface (CLI). It abstracts away numerous details like how to setup TypeScript. You develop your app with zero configuration using `nexus dev`, and then when you are ready, build it for production using `nexus build`. Once built, you run it in production like any other vanilla Node app.

_runtime_

There are a few runtime components. The one you'll deal with the most is the schema. It gives you powerful abstractions for implementing the GraphQL part of your API. Other runtime components include a JSON logger and HTTP server. It is possible to have a useful Nexus app that only ever touches the schema component, though most non-trivial apps will leverage all components.

_testtime_

Nexus pushes the boundaries of static typing as far as it can, but recognizes an unsatisfactory limit will be reached. Thus it embraces testing and ships with testtime components that are designed to pick up where static types drop off. While testtime components are the least developed so far, we think they will be a huge part of the value proposition, bringing levels of safetly typically associated with other [languages](https://www.idris-lang.org/) [and](https://www.haskell.org/) [tools](https://www.servant.dev/).

## Why

- Leverage the power of TypeScript at zero cost (setup/config headaches).
- Leverage the power of modern IDE features.
- Statically type code that would otherwise be impossible or impractical to type.
- Ruby-on-Rails like wholistic thinking.
