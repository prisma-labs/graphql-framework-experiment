> For this tutorial we will use PostgreSQL as our database. Install PostgreSQL if needed and then get its connection URL. Check out [our postgresql setup guide](references/recipes?id=localql) if unsure.

## Scaffold Project

Kick off a new project. Say yes (`y`) to the prisma option. Choose `PostgreSQL` for the db option.

```cli
npx nexus
```

## Change the Data Layer

Our Hello World schema doesn't account for information about moons, lets change that.

Start by updating our data layer to model information about moons. We don't want to go crazy scientific here but a bit of modelling will serve us well. A world may have more than one moon, and a moon may have properties in its own right. So lets give moons a first class model representation. Then, we can connect them to their respective worlds:

```diff
+++ prisma/schema.prisma
  model World {
    id         Int    @id
    name       String @unique
    population Float
+   moons      Moon[]
  }

+ model Moon {
+   worldId Int    @id @default(autoincrement())
+   name    String
+   world   World  @relation(fields: [worldId], references: [id])
+ }
```

Nexus reacts to changes in your Prisma schema. By saving the above, you will see a prompt in dev mode about applying your database changes.

```
   0 ● nexus:plugin:nexus-plugin-prisma We detected a change in your Prisma Schema file.
   0 ● nexus:plugin:nexus-plugin-prisma If you're using Prisma Migrate, follow the step below:
   0 ● nexus:plugin:nexus-plugin-prisma 1. Run yarn -s prisma migrate save --experimental to create a migration file.
   0 ● nexus:plugin:nexus-plugin-prisma 2. Run yarn -s prisma migrate up --experimental to apply your migration.
? Press Y to restart once your migration is applied › (Y)
```

Once done, you can move on to updating your API layer.

## Change the API Layer

We have data about `Earth` from before, but now we need to update it with information about its moon. Instead of working with Prisma Client inside one-off scripts, lets enhance our API and make the update as if a client app were.

We're going to need to expose the `moons` world field to clients

```diff
+++ api/graphql.ts
  schema.objectType({
    name: "World",
    definition(t) {
      t.model.worldId()
      t.model.name()
      t.model.population()
+     t.model.moons()
    }
  })
```

Upon doing this however, we will see a warning in our dev mode logs:

```
 Warning: Your GraphQL `World` object definition is projecting a field `moons` with `Moon` as output type, but `Moon` is not defined in your GraphQL Schema
 Warning: in /Users/x/foobar/api/graphql.ts:10:13

   6 definition(t) {
   7 t.model.id();
   8 t.model.name();
   9 t.model.population();
 → 10 t.model.moons();
```

The feedback is pretty clear already but to restate: The problem is that we're projecting a Prisma model field (`moons`) that is a connection to another Prisma model (`Moon`) that has not been projected on our API layer. So let's do that now:

```diff
+++ api/graphql.ts
+schema.objectType({
+  name:'Moon',
+  definition(t){
+    t.model.id()
+    t.model.name()
+    t.model.world()
+   }
+})
```

Do not copy-paste. Instead type this out yourself and take note how autocompletion within the `definition` block on `t.model` effectively guides you to success.

Once you have projected `Moon` from your data layer to your API layer, you will see that the dev mode warning and TypeScript error are now resolved. 🙌

## Add Some CRUD

If you go to your GraphQL Playground now you will see that your GraphQL schema now contains your Moon data shape too. But of course we still need to update `Earth` with data about _its_ moon. To achieve that we're going to expose CRUD actions that clients can use to update `Earth`.

```diff
+++ api/graphql.ts
+schema.mutationType({
+  definition(t){
+    t.crud.updateOneWorld()
+  }
+})
```

Again do not copy-paste. Type this out and see how it feels. Notice how auto-completion guides you from start to finish.

If we go back to our schema in GraphQL Playground now, we'll see a significant number of additions to the schema, a result of the CRUD features we've just enabled.

Now, let's give `Earth` its moon!

```graphql
mutation addMoonToEarth {
  updateOneWorld(where: { name: "Earth" }, data: { moons: { create: { name: "moon" } } }) {
    name
    moons {
      name
    }
  }
}
```

You should see a result like:

```json
{
  "data": {
    "updateOneWorld": {
      "name": "Earth",
      "moons": [
        {
          "name": "moon"
        }
      ]
    }
  }
}
```

## Deploy

We will Deploy to Heroku.

Before deploying let's change the playground server setting such that Playground will be enabled in production.

<p class="NextIs Warn" />

> We're doing this so we can easily try out our deployed app. Neither the GraphQL Playground UI nor the GraphQL API itself are secured. This is not intended to demonstrate a production-ready setup.

```diff
+++ api/app.ts
+ import { settings, use } from 'nexus'
import { prisma } from 'nexus-plugin-prisma'

use(prisma())

+settings.change({
+  server: {
+    playground: true
+  }
+})
```

Then, create an account at [Heroku](https://www.heroku.com/) (if you don't already have one) and [setup the CLI](https://devcenter.heroku.com/articles/heroku-cli).

1.  Create a new Heroku app

    ```cli
    heroku create
    ```

1.  Add a postgres database to it

    ```cli
    heroku addons:create heroku-postgresql
    ```

1.  Find the postgres database connection URL

    ```cli
    heroku pg:credentials:url
    ```

    Copy it into `prisma/.env` to give Prisma access.

1.  Migrate the heroku postgres database

    ```cli
    yarn prisma migrate up --experimental
    ```

    Or if using `npm`:

    ```cli
    npx prisma migrate up --experimental
    ```

1.  Commit your changes to Git

    ```cli
    git add .
    git commit -m "updates for deployment to Heroku"
    ```

1.  Deploy your Nexus app

    ```cli
    git push heroku master
    ```

1.  Open your hosted playground

    ```cli
    heroku open
    ```

1.  Try running the mutation from above, but now against your heroku database.

## Next Steps

A good next step might be to read through some of the guides.

Some good ones for new comers include the [`Concepts`](/guides/concepts) guide that gives an overview about how to think about Nexus, and the [`Schema`](/guides/schema) guide that goes through the ins and outs of building a GraphQL schema in Nexus.

Happy coding! 🙌
