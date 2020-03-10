# Introduction

> Nexus [schema](https://github.com/prisma-labs/nexus) is becoming the Nexus framework. Learn more about the transition in this [GitHub issue](https://github.com/prisma-labs/nexus/issues/373). Learn how to migrate your app in the [migration guide](/getting-started/migrate-from-nexus-schema).

Nexus is a framework for building GraphQL APIs in Node.

Here are some of the things Nexus cares about:

- Type safety across your entire stack
- Tooling across your entire devlopment lifecycle
- Great developer experience
- A deep plugin system
- Testing

#### Hello World Example {docsify-ignore}

Here is what a hello world looks like:

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
