# Chapter 2 <br> Writing Your First Schema {docsify-ignore}

In this chapter you're going to write your first schema. You'll learn about:

- Writing GraphQL objects
- Exposing GraphQL objects for query operations
- GraphQL SDL file generation
- Enhanced type safety & autocompletion

<div class="NextIs SectionDivider"></div>

## What About That Server?

In the last chapter you probably noticed the minimal setup required to get up and running. In fact, you might even be confused and wondering:

"Hey, all I have is an empty `app.ts` file, how can my server even be running?"

Well, Nexus comes with a server out of the box. There's no need for you to start or stop the server or otherwise think about it beyond your domain logic. Nexus wants you to focus on what makes your GraphQL API unique.

If your lock-in fears are tingling, know that **you still have _full_ access** to the underlying server instance. So if you need to add custom middlewares, routes, and so on, you can. It happens that currently it is an `express` instance but this area of Nexus will evolve ([#295](https://github.com/graphql-nexus/nexus/issues/295)).

<div class="NextIs SectionDivider"></div>

## Reflection?

Before we get going we need a moment to introduce an important part of the Nexus development workflow. Nexus has an unconventional concept called "Reflection". It refers to the fact that, when `nexus dev` or `nexus build` is running, not only is your application code being run, but **information is being gathered and artifacts are being derived**. Some of Nexus' uses for reflection include:

- Figuring out which plugins you are using, and the settings passed
- Generating TypeScript types to give your resolvers complete type safety
- Generating an SDL file

This partly explains why Nexus has a declarative API. It needs a way to run your app reliably at build time. Declarative APIs give Nexus a higher degree of control to do this. Declarative APIs also encode enough semantic value for Nexus to do the things it needs to.

Architecturally there's a lot more to say about reflection but for now, from a user point of view, just remember the following. You should _always_ have your `nexus dev` running when you're working on your project _even_ when you're not intending to use your server (e.g. access the GraphQL Playground). If you forget to run `nexus dev` then you will not, for example, get the static typing experience that you expect in your resolvers.

> There are plans to run Nexus Reflection as a separate process integrated into your IDE. You can learn more about and track the feature here ([#949](https://github.com/graphql-nexus/nexus/issues/949))

<div class="NextIs SectionDivider"></div>

## Model The Domain

Let's get started with our blog schema by modeling some key entities in the domain. We'll begin with the concept of a `User`. Someone that can write posts on the blog. Your modeling work is going to start on the API layer as opposed to the database layer. This API-first approach can be a good way to collaborate with frontend teams, getting their input in shaping the data early.

> A note about terminology. We will be talking about the Product Object not Product Model. The difference is that at the API layer we have objects but at the database layer we have models. The name difference helps us talk about these different layers without confusion. It is also how GraphQL (API layer) and Prisma (database layer, discussed later) respectively refer to these things.

Create a new module for your Product object at `api/graphql/User.ts`. We _could_ write our whole schema within say `api/app.ts` or `api/graphql.ts`, but modularizing your GraphQL type definitions can help scale your codebase. Neither approach is inheritly wrong though, so do as you see you fit. For this tutorial we'll use the modular style.

```bash
mkdir api/graphql && touch api/graphql/Product.ts
```

To create the `User` object we'll import the `schema` component from the `nexus` package. `schema` is where you'll find all the building blocks to craft your GraphQL types. Right now we are interested in the `schema.objectType` method, which, unsurprisingly, helps building [GraphQL Object Types](https://graphql.org/graphql-js/object-types/).

<!-- prettier-ignore -->
```ts
// api/graphql/User.ts

import { schema } from 'nexus'

schema.objectType({
  name: 'User',       // <- Name of your type
  definition(t) {
    t.int('id')       // <- Field named `id` of type `Int`
    t.string('name')  // <- Field named `name` of type `String`
    t.int('email')    // <- Field named `price` of type `Int`
  },
})
```

<div class="NextIs SectionDivider"></div>

## SDL?

Once you've saved this file change to disk, your app will be restarted and the previous warning you had about an empty GraphQL schema should be gone.

You may notice that there's also now a new `schema.graphql` file at your project root. It contains a representation of your schema in a syntax called the GraphQL Schema Definition Language (SDL for short). In dev mode Nexus generates this for you at every app restart. In it you should see the following:

```graphql
type User {
  id: Int
  name: String
  email: string
}
```

You are free to disable this file (settings discussed later) but its existence has two benefits for you to consider:

1. For users familiar with SDL the correspondance between the source code and it may help them learn Nexus' schema API faster.
2. The SDL syntax makes it an accessible way for others to evaluate incoming API changes without having to know about Nexus, or even JavaScript. Consider using the generated SDL file to improve your pull-request reviews.

For the remainder of this tutorial we'll be keeping SDL to the right of Nexus code blocks.

<div class="NextIs SectionDivider"></div>

## Your First Home Grown Query

Your `User` object is in place now but there's still no way for clients to read that data. Let's change that. You'll use the special `Query` object to expose your User object. Here's how it looks:

<div class="TightRow">

<!-- prettier-ignore -->
```ts
// api/graphql/Product.ts   // 1
// ...

schema.extendType({
  type: 'Query',            // 2
  definition(t) {
    t.field('users', {      // 3
      type: 'User',         // 4
      list: true,           // 5
    })
  },
})
```

```graphql
type Query {
  users: [User!]
}
```

</div>

1. The Query object is a central place in your schema where many other types will appear. Like before with the modular GraphQL types decision we again can decide to be modular here. We could either create a new `api/graphql/Query.ts` module (not modular), or we could _collocate_ the exposure of User object with its definition in `api/graphql/User.ts` (modular). Staying consistent with before, we'll take the modular way.
1. To achieve colocation in Nexus we'll use `schema.extendType`. Its API is _very_ similar to `schema.objectType` with the difference that the defined fields are merged into the _targeted_ type.
1. The first parameter specifies the field's name, here `users`
1. `type: 'User'` specifies what the field's type should be. Here, a `User`
1. `list: true` augments the field's type spec, making it wrapped by a List type. Here, a `[User]`. Nexus also provides the following shorthand for this 👇

   ```ts
   definition(t) {
     t.list.field('users', { ... })
   }
   ```

<div class="NextIs SectionDivider"></div>

<!-- ## Root Types -->

<!-- TODO rethink this content; diagrams; later; it implicates backing types... -->

<!-- There is one last thing to do here. You should be seeing error feedback from your IDE that the `resolve` field is missing. This is because `Query` (along with `Mutation` and `Subscription`) are _root types_. In GraphQL, the _fields_ of root types, unlike the fields of all other types, are _entrypoints_ into your API graph. And an entrypoint _must,_ intuitively, begin the process of getting data to fulfill the incoming operation.

Now, the `resolve` property is where you, the developer, implement this process of getting data. Put another way, the `resolve` property is where you implement the logic that fulfills the field's specification. You may be noting how when we defined our `User` object, we did _not_ write resolvers for its fields. The reason for that is that Nexus provides _default_ resolvers for fields that are not root and that don't have resolvers. This default implementation is to return a property from the parent data of the same name as the field name. And when that's not possible (because the parent data diverges), then Nexus will let you know _statically_, requiring the resolver from you. What's awesome is that none of this is require knowledge to get productive with Nexus thanks to the static error that Nexus will give you along the way right in your IDE. Follow these and for the most part you'll fall into the pit of success. Awesome!

We will not go into more detail about the data resolution systems of GraphQL and Nexus just now. This was just a brief overview to give you a sense of what is going on. Mastering a complete mental model will take a bit of time and practice. -->

You'll see some feedback from your IDE that you're missing a `resolve` property. Go ahead and try to implement it, letting the autocompletion guide you.

> You might be wondering why Nexus hasn't complained about misisng resolvers in some other cases so far. The answer is a more advanced topic that we'll cover later.

```ts
import { schema } from 'nexus'

schema.extendType({
  type: 'Query',
  definition(t) {
    t.field('users', {
      type: 'User',
      list: true,
      resolve() {
        return [{ id: 1, name: 'Jill', email: 'jill@prisma.io' }]
      },
    })
  },
})
```

<div class="NextIs SectionDivider"></div>

## Try It Out

You can now open up your GraphQL playground and try the following query (left); In response, you should see something like so (right):

<div class="TightRow">

```graphql
{
  users {
    id
    name
  }
}
```

```graphql
{
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Jill"
      }
    ]
  }
}
```

</div>

<div class="NextIs SectionDivider"></div>

## Wrapping Up

Congratulations! You've successfully got your first GraphQL schema up and running with Nexus! In the next chapter we'll explore adding some write capabilities to our API.

<div class="NextIs NextChapter"></div>

[➳](/tutorial/chapter-3-adding-mutations-to-your-api)
