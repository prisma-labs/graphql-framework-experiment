# Chapter 3 <br> Adding Mutations to Your API {docsify-ignore}

In this chapter you're going to add some write capability to your API. You'll learn about:

- Writing GraphQL mutations
- Exposing GraphQL objects for mutation operations
- Working with GraphQL Context
- Working with GraphQL arguments

To keep our learning gradual we'll stick to in-memory data for now but rest assured a proper databases is coming in an upcoming chapter.

## Wire Up The Context

The first thing we'll do is setup an in-memory database and expose it to our resolvers using the _GraphQL context_.

The GraphQL Context is a plain JavaScript object shared across all resolvers. Nexus creates a new one for each request and adds a few of its own properties. Largely though, what it will contains will be defined by your app. It is a good place to, for example, attach information about the logged-in user.

So go ahead and create the database.

```bash
touch api/db.ts
```

```ts
// api/db.ts

export const db = {
  users: [{ id: 1, name: 'Jill', email: 'jill@prisma.io' }],
}
```

Now to expose it in our GraphQL context we'll use a new schema method called `addToContext`. We can do this anywhere in our app but a fine place is the `api/app.ts` module we already created in chapter 1.

```ts
// api/app.ts

import { schema } from 'nexus'
import { db } from './db'

schema.addToContext(() => {
  return {
    db,
  }
})
```

That's it. Behind the scenes Nexus will use the TypeScript compiler API to extract our return type here and propagate it to the parts of our app where the context is accessible. And if ever this process does not work for you for some reason you can use fallback to manually giving the types to Nexus like so:

```ts
module global {
  interface NexusContext {
    // type information here
  }
}
```

> **Note** For those familiar with GraphQL, you might be grimacing that we’re attaching static things to the context, instead of using export/import.
> This is a matter of convenience. Feel free to take a purer approach in your apps if you want.

## Use The Context

Now let's use this data to reimplement the `Query.users` resolver from the previous chapter.

```diff
schema.queryType({
  name: 'Query',
  definition(t) {
    t.list.field('users', {
      type: 'Users',
-      resolve() {
-        return [{ id: 1, name: 'Jill', email: 'jill@prisma.io' }]
+     resolve(_root, _args, ctx) {  // 1
+        return ctx.db.users     // 2
      },
    })
  },
})
```

1. Context is the _third_ parameter, usually identified as `ctx`
2. Simply return the data, Nexus makes sure the types line up.

**Did you notice?** Still no TypeScript type annotations required from you yet everything is still totally type safe. Prove it to yourself by hovering over the `ctx.db.users` property and witness the correct type information it gives you. This is the type propagation we just mentioned in action. 🙌

## Your First Mutation

Alright, now that we know how to wire things into our context, let's implement our first mutation. We're going to make it possible for your API clients to create new users through your API. This mutation will need a name. Rather than simply call it `createUser` we'll use language from our domain. In this case `signup` seems reasonable. There are similarities with our previous work with `Query.users`:

- `Mutation` is a root type, its fields are entrypoints.
- We can colocate mutation fields with the objects they relate to or centralize all mutation fields.

As before we will take the colocation approach.

<div class="TightRow">

<!-- prettier-ignore -->
```ts
// api/graphql/User.ts
// ...

schema.extendType({
  name: 'Mutation',
  definition(t) {
    t.field('signup', {
      type: 'User',
      nullable: false,              // 1
      resolve(_root, args, ctx) {
        ctx.db.users.push(/*...*/)
        return // ...
      },
    })
  },
})
```

```graphql
Mutation {
  signup: User!
}
```

</div>

1. By default in Nexus all output types are nullable. This is for [best practice reasons](https://graphql.org/learn/best-practices/#nullability). In this case, we want to guarantee [to the client] that a User object will always be returned upon a successful signup mutation.

   If you're ever dissatisfied with Nexus' defaults, not to worry, [you can change them globally](https://www.nexusjs.org/#/api/modules/main/exports/settings?id=schemanullableinputs).

We need to get the client's input data to complete our resolver. This brings us to a new concept, GraphQL arguments. Every field in GraphQL may accept them. Effectively you can think of each field in GraphQL like a function, accepting some input, doing something, and returning an output. Most of the time "doing something" is a matter of some read-like operation but with `Mutation` fields the "doing something" usually entails a process with side-effects (e.g. writing to the databse).

Let's revise our implementation with GraphQL arguments.

<div class="IntrinsicRow">

```diff
schema.extendType({
  name: 'Mutation',
  definition(t) {
    t.field('signup', {
      type: 'User',
+     args: {                                        // 1
+       name: schema.stringArg({ required: true }),  // 2
+       email: schema.stringArg({ required: true }), // 2
+     },
      resolve(_root, args, ctx) {
+       const user = {
+         id: Number(Math.random().toString().slice(2))
+         name: args.name,                           // 3
+         email: args.email,                         // 3
+       }
+       ctx.db.users.push(user)
+       return user
-       ctx.db.users.push(/*...*/)
-       return // ...
      },
    })
  },
})
```

```diff
Mutation {
-  signup: User
+  signup(name: String!, email: String!): User
}
```

</div>

1. Add an `args` property to the field definition to define its args. Keys are arg names and values are type specifications.
2. Use the Nexus helpers for defining an arg type. There is one such helper for every GraphQL scalar such as `schema.intArg` and `schema.booleanArg`. If you want to reference a type like some InputObject then use `schema.arg({ type: "..." })`.
3. In our resolver, access the args we specified above and pass them through to our custom logic. If you hover over the `args` parameter you'll see that Nexus has properly typed them including the fact that they cannot be undefined.

## Model The Domain pt 2

Before we wrap this chapter let's flush out our schema a bit more. We'll add `Post` objects to represent content by authors and `Blog` objects to represent groupings of users and posts. We'll also tweak our existing `User` objects to relate to blogs and posts. Finally we'll update our in memory database. There are no new concepts here so we'll move briskly.

<div class="IntrinsicRow">

```ts
// api/graphql/Blog.ts

import { schema } from 'nexus'

schema.objectType({
  name: 'Blog',
  definition(t) {
    t.int('id', { nullable: false })
    t.string('name', { nullable: false })
    t.list.field('posts', {
      type: 'Post',
      nullable: false,
      resolve(blog, _args, ctx) {
        return ctx.db.posts.filter((post) => {
          return post.blogId === blog.id
        })
      },
    })
    t.list.field('users', {
      type: 'User',
      nullable: false,
      resolve(blog, _args, ctx) {
        return ctx.db.users.filter((post) => {
          return user.blogIds.includes(blog.id)
        })
      },
    })
  },
})
```

```graphql
type Blog {
  id: Int!
  name: String!
  posts: [Post!]!
  users: [User!]!
}
```

</div>
<div class="IntrinsicRow">

```ts
// api/graphql/Post.ts

import { schema } from 'nexus'

schema.objectType({
  name: 'Post',
  definition(t) {
    t.int('id', { nullable: false })
    t.string('title', { nullable: false })
    t.string('body', { nullable: false })
    t.field('author', {
      type: 'User',
      resolve(post, _args, ctx) {
        return (
          ctx.db.users.find((user) => {
            return user.id === post.authorId
          }) ?? null
        )
      },
    })
  },
})
```

```graphql
type Post {
  id: Int!
  title: String!
  body: String!
  author: User
}
```

</div>

Evidently most of data isn't nullable! Its pretty annoying to write and read that repetition. Luckily Nexus allows us to change the nullability defaults at the object level.

<div class="IntrinsicRow">

```diff
schema.objectType({
  name: 'Blog',
+ nonNullDefaults: {
+   output: true,
+ },
  definition(t) {
+   t.int('id')
-   t.int('id', { nullable: false })
+   t.string('name')
-   t.string('name', { nullable: false })
    t.list.field('posts', {
      type: 'Post',
-     nullable: false,
      resolve(blog, _args, ctx) {
        return ctx.db.posts.filter((post) => {
          return post.blogId === blog.id
        })
      },
    })
    t.list.field('users', {
      type: 'User',
-     nullable: false,
      resolve(blog, _args, ctx) {
        return ctx.db.users.filter((post) => {
          return user.blogIds.includes(blog.id)
        })
      },
    })
  },
})
```

```diff
schema.objectType({
  name: 'Post',
+ nonNullDefaults: {
+   output: true,
+ },
  definition(t) {
+   t.int('id')
-   t.int('id', { nullable: false })
+   t.string('title')
-   t.string('title', { nullable: false })
+   t.string('body')
-   t.string('body', { nullable: false })
    t.field('author', {
      type: 'User',
+     nullable: true,
      resolve(post, _args, ctx) {
        return (
          ctx.db.users.find((user) => {
            return user.id === post.authorId
          }) ?? null
        )
      },
    })
  },
})
```

</div>

<!-- TODO maybe we should introduce nullable config in chapter 2... -->

While tweaking our `User` object to relate to posts and blogs we'll also make its field return types non-nullable.

```diff
schema.objectType({
  name: 'User',
+ nonNullDefaults: {
+   output: true,
+ },
  definition(t) {
    t.int('id')
    t.string('name')
    t.int('email')
    t.list.field('posts', {
      type: 'Post',
      nullable: false,
      resolve(user, _args, ctx) {
        return ctx.db.posts.filter((post) => {
          return post.authorId === user.id
        })
      },
    })
    t.list.field('blogs', {
      type: 'Blog',
      nullable: false,
      resolve(user, _args, ctx) {
        return ctx.db.blogs.filter((blog) => {
          return blog.userIds.includes(user.id)
        })
      },
    })
  },
})
```

```diff
type User {
- id: Int
- name: String
- email: string
+ id: Int!
+ name: String!
+ email: string!
+ posts: [Post!]!
+ blogs: [Blog!]!
}
```

And updates to our in-memory database at `api/db.ts`:

```diff
 export const db = {
-  users: [{ id: 1, name: 'Jill', email: 'jill@prisma.io' }],
+  users: [{ id: 1, name: 'Jill', email: 'jill@prisma.io', postIds: [], blogIds: [] }],
+  blogs: [{ id: 1, name: 'Foo', usersIds: [], postIds: [] }],
+  posts: [{ id: 1, title: 'Bar', body: '...', authorId: '1', blogId: '1' }],
 }
```

## Try It Out

Great, now head on over to the GraphQL Playground and run this query (left). If everything went well, you should see a response like this (right):

<div class="IntrinsicRow">

```graphql
mutation {
  signup(name: "Jim", email: "jim@prisma.io") {
    id
    name
    email
    posts {
      id
    }
    blogs {
      id
    }
  }
}
```

```json
{
  "data": {
    "signup": {
      "id": 2345185,
      "name": "Jim",
      "email": "jim@prisma.io",
      "posts": [],
      "blogs": []
    }
  }
}
```

</div>

## Wrapping Up

Congratulations! You can now read and write to your API.

But, so far you've been validating your work by manually interacting with the Playground. That may be reasonable at first (depending on your relationship to TDD) but it will not scale. At some point you are going to want automated testing. Nexus takes testing seriously and in the next chapter we'll show you how. See you there!

<div class="NextIs NextChapter"></div>

[➳](/tutorial/chapter-4-testing-your-api)
