> Nexus [schema](https://github.com/prisma-labs/nexus) is becoming the Nexus framework. Learn more about the transition in this [GitHub issue](https://github.com/prisma-labs/nexus/issues/373). Learn how to migrate your app in the [migration guide recipe](/references/recipes?id=migrate-from-nexus-schema).

# Introduction

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

## Videos {docsify-ignore}

_Development Series_

- [Feb 4 - #3 - Trompe-l'œil](https://prisma.zoom.us/rec/play/vMEsd-77_W03EtPA4gSDV6MrW9S1KKus0CQc-qAIzRq9AiULYAGmY7VDNuJfgub8BiqlMX_ZWAKXzQgv?continueMode=true)

  [![image](https://user-images.githubusercontent.com/284476/73783261-5d3e8680-4761-11ea-9310-4bcb35569a77.png)](https://prisma.zoom.us/rec/play/vMEsd-77_W03EtPA4gSDV6MrW9S1KKus0CQc-qAIzRq9AiULYAGmY7VDNuJfgub8BiqlMX_ZWAKXzQgv?continueMode=true)

* [Jan 21 - #2 - Abracadabra](https://www.loom.com/share/d91470a0e00b4175814128bfcd09a237)

  [![image](https://user-images.githubusercontent.com/284476/72774540-feadd000-3bd8-11ea-8e46-874030cf90db.png)](https://www.loom.com/share/d91470a0e00b4175814128bfcd09a237)

* [Dec 19 - #1 - Hello World](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

  [![image](https://user-images.githubusercontent.com/284476/71212025-786f3880-227e-11ea-9dee-467239d46993.png)](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

_Talks_

- on 2019/12/10 | by [Flavian Desverne](https://github.com/Weakky) | [GraphQL Berlin Meetup #16: Boosting backend development productivity](https://www.youtube.com/watch?v=AqQEfFXxZKo)
