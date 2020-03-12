# Schema

## Introduction

###### Importing

You will use the schema component of Nexus to build your GraphQL schema. You can import it as a named export from the main module of the `nexus-future` package. If you prefer you can also import the default `app` export and then access the `schema` property.

<!-- prettier-ignore -->
```ts
import app from 'nexus-future'        // default style
import { schema } from 'nexus-future' // named-export style

app.schema === schema // true
```

<p class="NextIs Tip"></p>

> Leverage [VSCode auto-import](https://code.visualstudio.com/docs/languages/typescript#_auto-imports). Anywhere in a TypeScript module in your project type either `app` to summon auto-import for the default style or `schema` for named-export style.

###### Singleton & Mutation

The schema component is part of the app singleton and usage of its methods affects the overall app state. While this is not a functionally pure approach it does allow you to use its methods throughout your project without having to think about exporting/importing values. One of Nexus' design goals is to approach the ease and readability of [GraphQL SDL](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51) where we can. This is one example of doing that.

As an example, the following snippet shows the addition of an object type to the GraphQL schema. Notice how the return value is not used in any way. The method is actually mutating the app state.

```ts
import { schema } from 'nexus-future'

schema.objectType({
  name: 'Foo',
  definition(t) {
    t.string('bar', () => 'qux')
  },
})
```

## The Building Blocks

We will now begin exploring the GraphQL schema building parts of the schema component. Having prior knowledge of GraphQL language itself will greatly help. If you are new to GraphQL you may want to read some of the resources listed below.

- [graphql.org](https://graphql.org)
- [howtographql.com](https://www.howtographql.com)

### Meet the Object Type

###### Basic Anatomy

<!-- prettier-ignore -->
```ts
                                      schema.objectType({
// The singleton instance of ---------^      |
// the Nexus schema component                |
//                                           |
// A type Builder method --------------------^
                                        name: 'Foo',
// The name of this type ----------------------^
                                        definition(t) {
// The type definition block -----------^          |
// Where fields are defined                        |
//                                                 |
// Object of Object Type Field --------------------^
// Builder methods
                                          t.field('bar', {
// A field builder method ------------------^      |
// The name of this field -------------------------^
                                            type: 'Bar',
// The type of this field -------------------------^
                                            resolve(parent, args, ctx, info) {
// The method called to return a -----------^       |       |     |    |
// value for this field when queried                |       |     |    |
//                                                  |       |     |    |
// The backing data model for Foo ------------------^       |     |    |
//                                                          |     |    |
// The client arguments to this field ----------------------^     |    |
//                                                                |    |
// Contextual data for this request ------------------------------^    |
// Shared across all resolvers                                         |
//                                                                     |
// Technical detail about this request --------------------------------^
// E.g. client's query AST

// Your logic to return a value ------------> ...
// for this field
                                            },
                                          })

                                          t.string('qux')
// A scalar-type convenience builder -------^       |
//                                                  |
// No resolver means Nexus returns the -------------^
// `qux` property from the backing data model

                                        },
                                      })
```

###### Nexus | GraphQL: Basic fields

<div class="TwoUp">

```ts
schema.objectType({
  name: 'Alpha',
  definition(t) {
    t.id('a')
    t.string('b')
    t.int('c')
    t.float('d')
    t.boolean('e')
  },
})
```

```graphql
type Alpha {
  a: ID!
  b: String!
  c: Int!
  d: Float!
  e: Boolean!
}
```

</div>

###### Nexus | GraphQL: Lists & Nullability

<div class="TwoUp">

```ts
schema.objectType({
  name: 'Alpha',
  definition(t) {
    t.id('a', { nullable: true })
    t.list.id('b')
    t.list.id('c', { nullable: true })
    t.list.id('c', { list: [false] })
    t.list.id('c', { list: [false], nullable: true })
  },
})
```

```graphql
type Alpha {
  a: ID
  b: [ID!]!
  c: [ID!]
  c: [ID]!
  c: [ID]
}
```

</div>

### Meet the Enum Type

### Meet the Union Type

### Meet the Interface Type

### Meet the Input Object Type

### Meet Field Arguments
