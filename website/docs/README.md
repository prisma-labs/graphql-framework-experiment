# Introduction

`nexus-future` is a framework for building GraphQL APIs in Node.

Here are some of the things `nexus-future` cares about:

- Delightful developer experience
- A CLI supporting devlopment lifecycle workflows
- A deep plugin system for both runtime and CLI
- Type-Safety across your entire codebase
- Integration Testing

## Hello World Example {docsify-ignore}

Here is what a hello world looks like:

```ts
import { app } from 'nexus-future'

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

## Videos {docsify-ignore}

_Development Series_

- [Jan 21 - #2 - Abracadabra](https://www.loom.com/share/d91470a0e00b4175814128bfcd09a237)

  [![image](https://user-images.githubusercontent.com/284476/72774540-feadd000-3bd8-11ea-8e46-874030cf90db.png)](https://www.loom.com/share/d91470a0e00b4175814128bfcd09a237)

- [Dec 19 - #1 - Hello World](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

  [![image](https://user-images.githubusercontent.com/284476/71212025-786f3880-227e-11ea-9dee-467239d46993.png)](https://www.loom.com/share/fed163245bcc498495e664374ef662f3)

_Talks_

- on 2019/12/10 | by [Flavian Desverne](https://github.com/Weakky) | [GraphQL Berlin Meetup #16: Boosting backend development productivity](https://www.youtube.com/watch?v=AqQEfFXxZKo)
