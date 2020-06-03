# Chapter 5 <br> Persisting Data (via Prisma) {docsify-ignore}

So far we have been working with in-memory data while we learn about other parts of Nexus in a focused manner, but in this chapter we're going to put the focus squarely on data and show how Nexus can be used with a database. This marks an important step toward your e-commerce app becoming more real. You'll learn about:

- Prisma
- Nexus Plugins
- Setting up a Postgres database locally

We're going to be using a database called Postgres and a tool called Prisma to interact with it. Postgres is a well known open-source relational database. Prisma is a new way of working with databases that we'll learn more about in a moment. Its important to understand that Nexus does not _require_ these technology choices and _could_ actually be used with any database and abstractions over them (raw SQL, query builder, ORM..). However, Nexus is built by a team at Prisma (the company) and unsurprisingly there is great integration between its tools and Nexus.

## Prisma?

So, what _is_ Prisma? It is an open source database toolkit that consists of the following parts:

**Prisma Client**: Auto-generated and type-safe query builder for Node.js & TypeScript
**Prisma Migrate** (experimental): Declarative data modeling & migration system
**Prisma Studio** (experimental): GUI to view and edit data in your database

At the heart of Prisma is the _Prisma Schema,_ a file usually called `schema.prisma`, that you will see later in this tutorial. It is a declarative file wherein using a domain specific language you encode your database schema, connection to the database, and more.

Prisma has great [docs](https://www.prisma.io/docs/understand-prisma/introduction) so definitely check them out at some point. For now you can stay in the flow of this tutorial if you want though. We're going to focus on Prisma Client.

## Nexus plugins?

Now we're ready to actually use Prisma with Nexus! This is going to be achieved by way of a Nexus _plugin_. What? Yep, Nexus has a plugin ecosystem which can be used to enhance your app and development experience in a number of ways! Nexus Plugins broadly breakdown into three areas of enhancement:

1. **worktime:** watch new file types, hook onto events, attach new CLI commands, ...
2. **runtime:** add schema middleware, setting presets, field builders, custom scalars, ...
3. **testtime:** attach data to the Nexus Test Context

Plugin packages are usually named after the following convention: `nexus-plugin-<name>` and we refer to them just by either name suffix part. So for the example when we say that Prisma and Nexus integrate together via the Nexus `prisma` plugin that means `nexus-plugin-prisma`.

Another convention that they usually follow is that they use the default export of the package as well as a named export that is a camel case variant of the name part mentioned before (see below for example).

Plugins are easy to use:

```markdown
npm add nexus-plugin-foo
```

```ts
import foo from 'nexus-plugin-foo'
import { foo } from 'nexus-plugin-foo' // alternative, as you wish
import { use } from 'nexus'

use(foo())
```

All plugins are functions. They can accept optional or required settings if the plugin authors wishes so. Once a plugin is imported and invoked, its return value is passed to the Nexus `use` method. Once done, your app is using the plugin. On the surface the method looks similar to that of `express`'s `use`.

Note how the plugins only exist within your app code yet we mentioned before that plugins can augment worktime aspects like the CLI. Neat right? No external config files with plugin setup are required. Its one of examples of how Nexus provides a powerful and extensible system without forwarding you, the user, a complexity tax for it.

## Connect to your database

Now that you know a bit about Prisma and Nexus plugins, let's get going! Do the following:

- Install the Prisma plugin
- Use it in your `api/app.ts` module
- Create your Prisma Schema
- Connect to your database

like so:

```bash
npm add nexus-plugin-prisma
```

```ts
// api/app.ts

import { use } from 'nexus'
import { prisma } from 'nexus-plugin-prisma'

use(prisma())
```

```bash
mkdir prisma && touch prisma/schema.prisma
```

```groovy
// prisma/schema.prisma

datasource postgres {
  provider = "postgresql"
  url      = "<postgres_connection_url>"
}
```

Almost done, but we still need to setup a Postgres database for our app to connect to. There are a ton of ways to do this so we're just going to show the most straight forward cross-platform way we know how. First, make sure you have [docker installed](https://docs.docker.com/get-docker/). Then, simply run this command:

```
❯ docker run --detach --publish 5432:5432 -e POSTGRES_PASSWORD=postgres --name postgres postgres:10.12
```

That's it. You now have a Postgres server running. You can connect to it at a URL like:

```markdown
postgresql://postgres:postgres@localhost:5432/myapp
```

If you prefer setting up your local Postgres another way go for it. If our suggest approach doesn't work for you, then checkout a few other approaches listed on the [Nexus recipes page](https://www.nexusjs.org/#/references/recipes?id=setting-up-postgresql).

In your Prisma Schema file replace `<postgres_connection_url>` with your actual database URL.

Confirm things are setup correctly by ... **TODO: find a way to make sure their connection url is working**

## Create your database schema

It is now time to replace our in-memory data with actual tables in our database. To do this we'll write models in our Prisma Schema. In chapters 2 and 3 we already began to model our e-com domain with GraphQL types `Product` `Order` and `OrderItem`. We can base our models on that prior work, resulting in a Prisma Schema like so:

```groovy
// prisma/schema.prisma
// ...

model Product {
  id    Int    @id @default(autoincrement())
  name  String
  price Int
}

model Order {
  id    Int         @id @default(autoincrement())
  total Int
  items OrderItem[]
}

model OrderItem {
  id           Int    @id @default(autoincrement())
  productName  String
  productPrice Int
  quantity     Int
  orderId      Int?
  order        Order? @relation(fields: [orderId], references: [id])
}
```

With our database schema specified, we're now ready to proceed to our first database migration! To do that, we'll use the Prisma CLI.

Generate our migration files...

```bash
npx prisma migrate save --experimental
```

Then, apply the migration...

```bash
npx prisma migrate up --experimental
```

## Access your database

Now let's finally ditch our in-memory data! Let's start by removing the `api/db.ts` module and then be guided by TypeScript errors.

```bash
rm api/db.ts
```

In `api/app.ts` module, remove the db import and the `schema.addToContext` call.

```diff
+++ api/app.ts

- import { schema, use } from 'nexus'
+ import { use } from 'nexus'
  import { prisma } from 'nexus-plugin-prisma'
- import { db } from './db'

  use(prisma())

- schema.addToContext(() => {
-   return {
-     db,
-   }
- })
```

You might be wondering how you'll maintain access to the `db` client in your GraphQL Context given that we've just deleted it. Nexus plugins help here. One of their many capabilities is augmenting your GraphQL context. In this case, the prisma plugin adds a `db` property, an instance of Prisma Client, one of the tools in the Prisma toolkit.

Let's now replace all our previous in-memory db interactions with calls to the Prisma Client

```diff
schema.extendType({
  type: 'Query',
  definition(t) {
    t.list.field('products', {
      type: 'Product',
      resolve(_root, _args, ctx) {
-        return ctx.db.products
+        return ctx.db.product.findMany()
      },
    });
  },
});
```

```diff
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
      async resolve(_root, args, ctx) {
+       const products = await ctx.db.product.findMany({
+         where: { id: { in: args.items.map((i) => i.productId) } },
+       });
        const items = args.items.map((item) => {
-         const product = ctx.db.products.find((p) => p.id === item.productId)!;
+         const product = products.find((p) => p.id === item.productId);

          if (!product) {
            throw new Error(`Could not find product with id ${item.productId}`);
          }

          return {
-           id: ctx.db.orderItems.length + index + 1, // generate ids for our order items
            productName: product.name,
            productPrice: product.price,
            quantity: item.quantity, // associate the quantity
          };
        });

-       ctx.db.orderItems.push(...items);

        const total = items.reduce(
          (price, i) => price + i.productPrice * i.quantity,
          0
        );

-       const newOrder = {
-         id: ctx.db.orders.length,
-         items,
-         total,
-        };

+       const newOrder = await ctx.db.order.create({
+         data: {
+           total,
+           items: {
+             create: items,
+            },
+         },
+         include: { items: true },
+       });

-       ctx.db.orders.push(newOrder);

        return newOrder;
      },
    });
  },
});
```

If you need a copy & pastable version, here it is

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
      async resolve(_root, args, ctx) {
        const products = await ctx.db.product.findMany({
          where: { id: { in: args.items.map((i) => i.productId) } },
        })
        const items = args.items.map((item) => {
          const product = products.find((p) => p.id === item.productId)

          if (!product) {
            throw new Error(`Could not find product with id ${item.productId}`)
          }

          return {
            productName: product.name,
            productPrice: product.price,
            quantity: item.quantity, // associate the quantity
          }
        })

        const total = items.reduce((price, i) => price + i.productPrice * i.quantity, 0)

        const order = await ctx.db.order.create({
          data: {
            total,
            items: {
              create: items,
            },
          },
          include: { items: true }, // Include the created order items in the result
        })

        return order
      },
    })
  },
})
```

## Try It Out

Awesome, you're ready to open up the playground and buy a few things! If all goes well, good job! If not, no worries, there's a lot of integration pieces in this chapter where something could have gone wrong. If after reviewing your steps you still don't understand the issue, feel free to open up a [discussion](https://nxs.li/discussions) asking for help.

## Wrapping Up

We've just changed our code, so we must be due or overdue for a test update right? Well, in the next chapter we'll do just that, and show you how Nexus testing works with Prisma.

<div class="NextIs NextChapter"></div>

[➳](/tutorial/chapter-6-testing-with-prisma)
