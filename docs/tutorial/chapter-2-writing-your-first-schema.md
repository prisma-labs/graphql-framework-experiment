# Chapter 2 <br> Writing Your First Schema {docsify-ignore}

In this chapter you're going to write your first schema. You'll learn about:

- Writing GraphQL objects
- Exposing GraphQL objects for query operations
- GraphQL SDL file generation
- Enhanced type safety & autocompletion

<div class="NextIs SectionDivider"></div>

## Server?

In the last chapter you probably noticed the minimal setup required to get up and running. In fact, you might even be confused and wondering:

"Hey, all I have is an empty `app.ts` file, how can my server even be running?"

Well, Nexus comes with a server out of the box. There's no need for you to start or stop the server or otherwise think about it beyond your domain logic. Nexus wants you to focus on what makes your GraphQL API unique.

If your lock-in fears are tingling, know that **you still have _full_ access** to the underlying server instance. So if you need to add custom middlewares, routes, and so on, you can. It happens that currently it is an `express` instance but this area of Nexus will evolve ([#295](https://github.com/graphql-nexus/nexus/issues/295)).

<div class="NextIs SectionDivider"></div>

## Reflection?

⚠️ Nexus has an unconventional concept called "Reflection". The `nexus dev` command runs your application code, but **it also derives artifacts from your app every time it is restarted. Namely, TypeScript types and GraphQL SDL file.**

We'll explore Reflection a bit more later, but \**\*\*for now just remember the following. You should *always* have your `nexus dev` running when you're working on your project *even\* when you're not intending to access the GraphQL Playground or otherwise run test queries against your API. If you don't do this, you will not get the static typing experience that you expect from Nexus.

> There are plans to run Nexus Reflection as a separate process integrated into your IDE. You can learn more about and track the feature here ([#949](https://github.com/graphql-nexus/nexus/issues/949))

<div class="NextIs SectionDivider"></div>

## Model

Let's get started with our e-commerce app by modeling some key entities in the domain. We'll begin with the concept of a `Product`. Something that sits in inventory and users can buy. Our modeling work is going to be done at the API level first but traditionally you might start at your database layer. We're starting with the API to reduce the concepts you need to learn at once here.

> A note about terminology. We will be talking about the Product Object not Product Model. The difference is that at the API layer we have objects but at the database layer we have models. The name difference helps us talk about these different layers without confusion. It is also how GraphQL (API layer) and Prisma (database layer, discussed later) respectively refer to these things.

Create a new module for your Product object at `api/graphql/product.ts`.

```bash
mkdir api/graphql && touch api/graphql/Product.ts
```

> We technically could write our whole app within `app.ts` but to keep the codebase scalable it is common practice to modularize your GraphQL type definitions. Still, for a simple app you might wish to put all your GraphQL type definitions into one module like `api/graphql.ts`. That works too! Nexus is flexible.

To create the the `Product` Object we'll import the `schema` component from the `nexus` package.

`schema` **is where you'll find all the needed building blocks to craft your GraphQL API**. Here, we are particularly interested in the `schema.objectType`, which, unsurprisingly, helps building [GraphQL Object Types](https://graphql.org/graphql-js/object-types/).

```tsx
// api/graphql/Product.ts

import { schema } from 'nexus'

schema.objectType({
  name: 'Product', // <-- Name of your type
  definition(t) {
    t.int('id') // <-- Field named `id` of type `Int`
    t.string('name') // <-- Field named `name` of type `String`
    t.int('price') // <-- Field named `price` of type `Int`
  },
})
```

Once you've saved this file change to disk, you should see your app get restarted in the terminal and the previous warning you had about an empty GraphQL schema now gone.

You may have noticed that there's now also a new `schema.graphql` file in your project root. This file contains the GraphQL Schema Definition Language (SDL) equivalent of the Nexus code you just wrote. Nexus generates this for you on every app restart during dev mode. In it you'll find the following:

```graphql
type Product {
  id: Int
  name: String
}
```

Nexus allows you to disable generating this file, but its existence has two benefits for you to consider:

1. It might be easier at first for newcomers to read this file and see how Nexus behaves.
2. It is valuable to commit it into your version control for pull-request reviews. The SDL file is an accessible way for others to evaluate incoming API changes without having to know about Nexus, or even JavaScript.

<div class="NextIs SectionDivider"></div>

## Your First Home Grown Query

Our `Product` object in place but there's still no way for clients of our API to query it. Let's change that. We'll use the special `Query` object type to expose our Product type. The SDL schema for this would look like as follows:

```graphql
type Query {
  products: [Product!]
}
```

The Query object is a central place in your schema where many other types will appear. From a code organization perspective we could either create a new `api/graphql/Query.ts` module or we could _collocate_ the exposure of Product type with its definition in `api/graphql/Product.ts`. In this tutorial we'll take the collocation approach. This organizing pattern often scales better on large apps.

To achieve colocation in Nexus we'll use `schema.extendType`. Its API is _very_ similar to the `schema.objectType` one.

**But before simply copy & pasting it**, please try to write down the snippet below manually.

This is not to bother you. This is to help you get a feeling for how Nexus reacts when you're typing.
If you're using an IDE, try to rely as much as possible on auto-completion. Especially for the `type` field and while writing the return value of the `resolve` method of the `products` field.

We'll start out with this:

```tsx
// api/graphql/Product.ts
// ...

schema.extendType({
  type: 'Query',
  definition(t) {
    t.field('products', {
      // 1
      type: 'Product', // 2
      list: true, // 3
    })
  },
})
```

Here's the breakdown of what's going on in our `t.field` so far:

1. The first parameter specifies the field's name, here `products`
2. `type: 'Product'` specifies what the field's type should be. Here, a `Product`
3. `list: true` augments the field's type spec, making it wrapped by a List type. Here, a `[Product]`

You should be seeing error feedback from your IDE that the `resolve` field is missing. This is because `Query` (along with `Mutation` and `Subscription`) are _root types_. In GraphQL, the _fields_ of root types, unlike the fields of all other types, are _entrypoints_ into your API graph. And an entrypoint _must,_ intuitively*,* begin the process of getting data to fulfill the incoming operation.

Now, the `resolve` property is where you, the developer, implement this process of getting data. Put another way, the `resolve` property is where you implement logic the fulfills the field's specification. You may now be noting how when we defined our `Product` object we did _not_ write resolvers for its fields. The reason for that is that Nexus provides _default_ resolvers for fields that are scalars and that are not roots. The default resolver implementation is to return a property from the parent data of the same name as the field name.

We will not go into more detail about the data resolution systems of GraphQL and Nexus just now. This was just a brief overview to give you a sense of what is going on. Mastering a complete mental model will take a bit of time and practice.

So go ahead and add an empty `resolve` method now. Once done, you will see a new error from your IDE about the return type of `resolve`. This makes sense. Our resolver, being empty, is not satisfying the specification we gave for `Query.products`. Thanks Nexus! Play around with autocompletion to return a value that will fix the error.

There's one more tweak we'll make before moving on. When specifying a field whose type is a list-of-something, there is a `t.list.*` shorthand you can use instead of `list: true`. Give it a shot, refactor your implementation like so 👇

```tsx
definition(t) {
  t.list.field('products', { ... })
}
```

If you inspect your `schema.graphql` file now, you should find this:

```graphql
type Query {
  products: [Product!]
}

type Product {
  id: Int
  name: String
}
```

If you're curious, you can now open the GraphQL playground by clicking on the URL logged by the `nexus dev` command. By default it should be `[http://localhost:4000/](http://localhost:4000/)` . Once you're there, try the following query:

```graphql
{
  products {
    id
    name
  }
}
```

In response, you should get this:

```graphql
{
  "data": {
    "products": [
      {
        "id": 1,
        "name": "ProductFoo"
      }
    ]
  }
}
```

<div class="NextIs SectionDivider"></div>

## Wrapping Up

Congratulations! You've successfully got your first GraphQL schema up and running with Nexus! In the next chapter we'll explore adding some write capabilities to our API.
