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

## Data Graph & Backing Types

As the API author, there are three design tasks you will invariable perform over and over again:

1. Create data types that model logical entities and concepts in your business domain.
2. Define connections between these data types that model how logical entities and concepts relate in your business domain.
3. Define entrypoints which allow traversal into this graph of data.

This is an iterative process that can generally be seen as an finite loop wherein your team gradually refines and expands (or contracts!) the data graph as you respond to changing client app needs, business needs, and so on. Data modelling is hard work, not least becuase there are usually many ways to achieve something with no immediate obvious answer about which approach is best. If the process of data modelling itself or data modelling in GraphQL is new to you, you may find this specialed book on the topic by [Marc-Andre Giroux](https://twitter.com/__xuorig__) helpful: [Production Ready GraphQL](https://book.productionreadygraphql.com/).

As you begin to implement a schema for the first time you will notice something that may not have been obvious at first. The data that the client sees in the data graph is _not_ the same data flowing through your resolvers used to fulfill that graph. The client sees the API types but internally you as the API author deal with _backing types_.

A small journey through query resolution of a contrived data graph will help illustrate the point.

```graphql
query {
  user(id: 5) {
    fullName
    age
    comments: {
      post {
        title
      }
    }
  }
}
```

1. Client sends query
2. `Query.user` field resolver runs
3. The db client fetches a user from the database and returns it
4. The type of `Query.user` field is an object type, `User`. It is not a scalar. That means its own fields need to be resolved in turn to fulfill the query. Resolvers for fields of `User` that have been selected by the client query are run (in this case: `fullName`, `age`, `comments`).
5. The three resolvers run. Their `parent` parameter is given the user model data fetched by the db client in step 2. _This is the backing type_.
6. The resolvers for `fullName` and `age`, upon returning, are the end of the resolution process along their respective branches. This is because scalars represent leafs in the resolution process. Notice how the GraphQL field `age` is implemented by composing multiple fields from the backint type.
7. The resolver for `comments` is an object type, and so its resolution looks essentially like how `User` got resolved above in step 2. So the resolver here fetches comments data from the database, which becomes the _backing type_ for the resolvers of `Comment` type _fields_.

Hopefully you can see how the GraphQL types that client sees are distinct from the backing types flowing through the resovlers.

Here is an example of the schema implementation:

```ts
schema.query({
  definition(t) {
    t.user({
      args: {
        id: schema.arg({ type: 'ID', required: true }),
      },
      resolve(_, { id }, { db }) {
        return db.fetchUser({ where: { id } })
      },
    })
  },
})

schema.object({
  name: 'User',
  rootTyping: 'Prisma.User',
  definition(t) {
    t.string('fullName', {
      resolve(user) {
        return [user.firstName, user.middleName, user.lastName].join(', ')
      },
    })
    t.int('age', {
      resolve(user) {
        return yearsSinceUnixTimestamp(user.birthDate)
      },
    })
    t.list.field('comments', {
      type: 'Comment',
      resolve(user, _args, { db }) {
        return db.comment.fetchMany({ where: { author: user.id } })
      },
    })
  },
})

schema.object({
  name: 'Comment',
  rootTyping: 'Prisma.Comment',
  definition(t) {
    t.string('title', {
      resolve(comment) {
        return comment.title
      },
    })
    t.field('body', {
      resolve(comment) {
        return comment.body
      },
    })
    t.field('post', {
      type: 'Post',
      resolve(comment, _args, { db }) {
        return db.post.fetchOne({ where: { id: comment.postId } })
      },
    })
    t.field('author', {
      type: 'User',
      resolve(comment, _args, { db }) {
        return db.user.fetchOne({ where: { id: comment.authorId } })
      },
    })
  },
})

schema.object({
  name: 'Post',
  rootTyping: 'Prisma.Post',
  definition(t) {
    t.string('title', {
      resolve(post) {
        return post.title
      },
    })
    t.field('body', {
      resolve(post) {
        return post.body
      },
    })
    t.list.field('comments', {
      type: 'Comment',
      resolve(post, _args, { db }) {
        return db.comment.fetchMany({ where: { id: post.commentId } })
      },
    })
  },
})
```

## The Building Blocks

We will now begin exploring the GraphQL schema building parts of the schema component. Having prior knowledge of GraphQL language itself will greatly help. If you are new to GraphQL you may want to read some of the resources listed below.

- [graphql.org](https://graphql.org)
- [howtographql.com](https://www.howtographql.com)

### Meet the Object Type

[graphql.org Object Types](https://graphql.org/learn/schema/#object-types-and-fields)

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

###### Scalar Fields

<div class="TwoUp NexusVSDL">

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

###### Relational Fields

<div class="TwoUp NexusVSDL">

```ts
schema.objectType({
  name: 'Alpha',
  definition(t) {
    t.field('beta', {
      type: 'Beta',
      resolve() {
        return { foo: 'bar' }
      },
    })
  },
})
schema.objectType({
  name: 'Beta',
  definition(t) {
    t.string('foo')
  },
})
```

```graphql
type Alpha {
  beta: Beta!
}

type Beta {
  foo: String!
}
```

</div>

###### Lists & Nullability

<div class="TwoUp NexusVSDL">

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

Enum types are a scalar with a finite set of allowed values. They can be used as argument types and as field types.

[graphql.org Enumeration Types docs](https://graphql.org/learn/schema/#enumeration-types)

<div class="TwoUp NexusVSDL">

```ts
schema.enum({
  name: 'Alpha',
  members: ['Zeta', 'Yolo'],
})
```

```graphql
enum Alpha {
  Zeta
  Yolo
}
```

</div>

###### Example: As argument type & field type

<div class="TwoUp NexusVSDL">

```ts
schema.queryType({
  definition(t) {
    t.field('anyAlpha', {
      type: 'Alpha',
      resolve(t) {
        return Math.random() > 0.1 : 'Zeta' : 'Yolo'
      }
    })
    t.list.field('alphas', {
      type: 'Alpha',
      args: {
        except: schema.arg({
          list: true,
          type: "Alpha",
          required: true,
        })
      },
      resolve(_root, args) {
        return ['Zeta', 'Yolo'].filter(alpha => {
          return !args.except.includes(alpha)
        })
      }
    })
  }
})
```

```graphql
type Query {
  anyAlpha: Alpha!
  alphas(except: [Alpha!]!): [Alpha!]!
}
```

</div>
<div class="TwoUp NexusVSDL">

```graphql
query {
  anyAlpha
  alphas(except: ["Zeta"])
}
```

```json
{
  "data": {
    "anyAlpha": "Zeta",
    "alphas": ["Yolo"]
  }
}
```

</div>

### Meet the Entrypoint Types

### Meet the Union Type

### Meet the Interface Type

### Meet the Input Object Type

### Meet Field Arguments

### Descriptions & Deprecations
