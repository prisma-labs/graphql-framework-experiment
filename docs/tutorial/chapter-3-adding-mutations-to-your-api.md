# Chapter 3 <br> Adding Mutations to Your API {docsify-ignore}

In this chapter you're going to add some write capability to your API. You'll learn about:

- Writing GraphQL mutations
- Exposing GraphQL objects for mutation operations
- Working with GraphQL Context
- Working with GraphQL arguments

To keep our learning gradual we'll stick to in-memory data for now but rest assured a proper databases is coming in an upcoming chapter.

## Wire Up The Context

The first thing we'll do is setup an in-memory database and expose it to our resolvers using the _GraphQL context_.

The GraphQL Context is a plain JavaScript object shared across all resolvers. Nexus creates it anew for each request and adds a few of its own properties. Largely though, what it will contains will be defined by your app. It is a good place to, for example, attach information about the current user.

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
> This is a matter of convenience. Feel free to take a purer approach in your apps if you want. Furthermore, it's likely that your actual db instance would be tight to the request cycle and therefore be instantiated in the GraphQL context.

## Use The Context

Now let's use this data to reimplement the the `Query.users` resolver from the previous chapter.

```diff
schema.queryType({
  name: 'Query',
  definition(t) {
    t.list.field('users', {
      type: 'Users',
-      resolve() {
-        return [{ id: 1, name: 'Jill', email: 'jill@prisma.io' }]
+     resolve(_root, _args, ctx) {  // 1
+        return ctx.db.products     // 2
      },
    })
  },
})
```

1. Context is the _thrid_ parameter, usually identified as `ctx`
2. Simply return the data, Nexus makes sure the types line up.

**Did you notice?** Still no TypeScript type annotations required from you yet everything is still totally type safe. Prove it to yourself by hovering over the `ctx.db.products` property and witness the correct type information it gives you. This is the type propagation we just mentioned in action. 🙌

## Model The Domain pt 2

Alright, now that we know how to wire things into our context, let's flush out our schema a bit more. We'll add `Post` objects to represent content by authors and `Blog` objects to represent groupings of users and posts.

We've already worked with objects now, let's dive in.

```ts
// api/graphql/Blog.ts
```

```ts
// api/graphql/Post.ts
```

We'll use some SDL to visualize what additions we'd like to make. We'll need a `Post` object to represent the actual writings of users. `Order` object to represent a store checkout and a `checkout` GraphQL mutation to perform checkouts.

```graphql
type Order {
  id: Int
  createdAt: DateTime
  items: [OrderItem] # Items of that order
  total: Int # Total of that order
}

type OrderItem {
  id: Int!
  productName: String! # Name of the product
  productPrice: String! # Price of the product
  quantity: Int! # Quantity of the product
}

type Mutation {
  checkout(items: [OrderItemInput!]!): Order
}

input OrderItemInput {
  productId: ID!
  quantity: Int!
}
```

> **Note:** `OrderItem` does not have a relation to a `Product` because we need orders to stay immutable. If a product is deleted after an order is placed, we need that order to stay intact, for accountability reasons.

Let's wrap up and see what the schema should look like overall

```graphql
type Query {
  products: [Product!]
}

type Mutation {
  checkout(items: [OrderItemInput!]!): Order
}

type Product {
  id: Int
  name: String
  price: Int
}

type Order {
  id: Int
  createdAt: DateTime
  items: [OrderItem!]
  total: Int
}

type OrderItem {
  id: Int!
  productName: String!
  productPrice: Int!
  quantity: Int!
}

input OrderItemInput {
  quantity: Int!
  productId: Int!
}
```

## Updating our in-memory database

Before we actually evolve our GraphQL schema, there's one thing we need to do: evolve our in-memory database. We need two new tables for the `orders` and `orderItems`.

Head to your `api/db.ts` file, and add the following

```diff
+ const orderItem = { id: 1, productName: 'ProductFoo', quantity: 1 }

export const db = {
   products: [{ id: 1, names: 'ProductFoo' }],
+	 orders: [{ id: 1, items: [orderItem] }],
+  orderItems: [orderItem]
};
```

## Implementing the designed schema

Now we're going to implement our desired schema changes in Nexus. If you want, try to implement it yourself and then come back here to compare your solution.

Create an `api/graphql/Order.ts` module that will contain both the `Order` and `OrderItem` objects. Because both objects are so closely related we're not bothering to create modules for each one.

```ts
// api/graphql/Order.ts

import { schema } from 'nexus'

schema.objectType({
  name: 'Order',
  definition(t) {
    t.int('id')
    t.list.field('items', {
      type: 'OrderItem',
    })
    t.int('total')
    //t.date('createdAt') // TODO: support t.date out of the box
  },
})

schema.objectType({
  name: 'OrderItem',
  definition(t) {
    t.int('id')
    t.string('productName')
    t.int('productPrice')
    t.int('quantity')
  },
})
```

Now have a look at your generated `schema.graphql` SDL file. _Did you notice something wrong?_

In our original schema design, we specified the `OrderItem` fields to _all_ be required.

In our current implementation though, they're all nullable. **That's because by default and [for best practices reasons](https://graphql.org/learn/best-practices/#nullability), all fields and output types are nullable by default.**

If you're ever not happy with these defaults, don't worry, [you can change them globally](https://www.nexusjs.org/#/api/modules/main/exports/settings?id=schemanullableinputs). For now though, we're interested in changing _only_ the defaults for the `OrderItem` fields. Each field can be made non-null.

```ts
schema.objectType({
  name: 'OrderItem',
  definition(t) {
    t.int('id', { nullable: false })
    t.string('productName', { nullable: false })
    t.int('quantity', { nullable: false })
  },
})
```

When only a few fields' nullability deviate from the default, field-level configuration like this is reasonable. But when a large majority of fields deviate, there is an alternative technique worth considering. Change the default nullability setting at the object level with `nonNullDefaults` setting. We'll do that for `OrderItem` now.

```ts
schema.objectType({
  name: 'OrderItem',
  nonNullDefaults: {
    output: true,
  },
  definition(t) {
    t.int('id')
    t.string('productName')
    t.int('quantity')
  },
})
```

Now let's add the `Mutation.checkout` mutation. Like before when we collocated the `Query.products` query with the `Product` object, we'll now colocate the `Mutation.checkout` mutation with the `Order` object.

Let's start with the following. Like in the last chapter we won't implement the resolver yet and so you'll see an expected static type error about in your IDE.

```ts
// ...

schema.extendType({
  type: 'Mutation',
  definition(t) {
    t.field('checkout', {
      type: 'Order',
      resolve() {
        // ...
      },
    })
  },
})
```

Now, to implement this checkout resolver, we're going to need it to accept some arguments, otherwise its going to be pretty useless! Looking back to our SDL we indeed had `items` arguments:

```ts
type Mutation {
  checkout(items: [OrderItemInput!]!): Order
}

input OrderItemInput {
  quantity: Int!
  productId: Int!
}
```

To implement this in Nexus we'll first create a new GraphQL Input Object called `OrderItemInput` using the `schema.inputObjectType` method. Since we want all fields of this input object to be required, we'll once again adjust the default nullability at the type level.

```ts
schema.inputObjectType({
  name: 'OrderItemInput',
  nonNullableDefaults: {
    input: true,
  },
  definition(t) {
    t.int('productId')
    t.int('quantity')
  },
})
```

Second, let's update our checkout mutation to use our newly created input object type. We'll use the `schema.arg` method which supports referencing input types defined in our schema.

```diff
schema.extendType({
  type: "Mutation",
  definition(t) {
    t.field("checkout", {
      type: "Order",
+      args: {
+        items: schema.arg({
+          type: "OrderItemInput",
+          list: true,
+          required: true,
+        }),
      },
      resolve(root, args) {
				// ...
      },
    });
  },
});
```

If you prefer a copy & pastable version, there you go

```ts
schema.extendType({
  type: 'Mutation',
  definition(t) {
    t.field('checkout', {
      type: 'Order',
      args: {
        items: schema.arg({
          type: 'OrderItemInput',
          list: true,
          required: true,
        }),
      },
      resolve(root, args) {
        // ...
      },
    })
  },
})
```

> **Note**: There's a handful of other methods you can use for scalar input types, such as `schema.intArg` , `schema.stringArg` , `schema.booleanArg` etc..

With the `items` arg setup, Nexus will now automatically statically type the `args` parameter of the `resolve` method. Verify that by hovering your cursor over the `args` parameter. We're now ready to implement the `Mutation.checkout` resolver! What do we want it to do?

1. Create the `OrderItem`s based on the incoming arguments
2. Push these to our in-memory database
3. Compute the total of the order based on the `OrderItem`
4. Create an `Order`
5. Push it to our in-memory database
6. Return our `Order`

Because of our in-memory database, the implementation is hairy. We'll try to do it step by step.
Don't worry, that mess will go away soon.

First, we map the incoming arguments to create some actual `OrderItem`s that we'll push to our database.

```ts
resolve(_root, args, ctx) {
  const items = args.items.map((item, index) => {
    const product = ctx.db.products.find((p) => p.id === item.productId)!;

    if (!product) {
      throw new Error(`Could not find product with id ${item.productId}`);
    }

    return {
      id: ctx.db.orderItems.length + index + 1, // generate ids for our order items
      productName: product.name,
      productPrice: product.price,
      quantity: item.quantity, // associate the quantity
    };
  });

  ctx.db.orderItems.push(...items) // Push them to the database
```

Then, we compute the total price of the order based on these items

```ts
const total = items.reduce((price, i) => price + i.productPrice * i.quantity, 0)
```

Finally, we create the actual order, we commit it to the database, and we return it

```ts
const newOrder = {
  id: ctx.db.orders.length,
  items,
  total,
}

ctx.db.orders.push(newOrder)

return newOrder
```

There's the entire implementation

```ts
resolve(_root, args, ctx) {
  const items = args.items.map((item, index) => {
    const product = ctx.db.products.find((p) => p.id === item.productId)!;

    if (!product) {
      throw new Error(`Could not find product with id ${item.productId}`);
    }

    return {
      id: ctx.db.orderItems.length + index + 1, // generate ids for our order items
      productName: product.name,
      productPrice: product.price,
      quantity: item.quantity, // associate the quantity
    };
  });

  ctx.db.orderItems.push(...items);

  const total = items.reduce(
    (price, i) => price + i.productPrice * i.quantity,
    0
  );

  const newOrder = {
    id: ctx.db.orders.length,
    items,
    total,
  };

  ctx.db.orders.push(newOrder);

  return newOrder;
}
```

Alright, there we are. If you're curious to try what you've just built, head over to the GraphQL Playground again and run this query:

```graphql
mutation {
  checkout(items: [{ productId: 1, quantity: 3 }]) {
    id
    items {
      id
      productName
      quantity
    }
    total
  }
}
```

In response, you should get this:

```json
{
  "data": {
    "checkout": {
      "id": 2,
      "items": [
        {
          "id": 3,
          "productName": "ProductFoo",
          "quantity": 3
        }
      ],
      "total": 30
    }
  }
}
```

## Wrapping Up

Congratulations! You can now read and write to your API. Good job. But, so far you've been validating your work by manual interacting with the Playground. That may be reasonable at first (depending on your relationship to TDD) but it will not scale. At some point you are going to want automated testing. Nexus takes testing seriously and in the next chapter we'll show you how. See you there!

<div class="NextIs NextChapter"></div>

[➳](/tutorial/chapter-4-testing-your-api)
