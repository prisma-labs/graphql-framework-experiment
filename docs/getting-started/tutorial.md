<!-- ## 1. Start a New Project

## 2. Create API Objects

## 3. Add Tests

## 4. Persist Data

## 5. secure Data

## 6. Add Integration Tests

## 7. Deploy to Production

## 8. ... -->

> For this tutorial we will use PostgreSQL as our database. Install PostgreSQL if needed and then get its connection URL. Check out [our postgresql setup guide](references/recipes?id=local-postgresql) if unsure.

## Scaffold Project

Kick off a new project. Say yes (`y`) to the prisma option. Choose `PostgreSQL` for the db option.

```cli
npx nexus-future
```

## Change the Data Layer

Our Hello World schema doesn't account for information about moons, lets change that.

Start by updating our data layer to model information about moons. We don't want to go crazy scientific here but a bit of modelling will serve us well. A world may have more than one moon, and a moon may have properites in its own right. So lets give moons a first class model representation. Then, we can connect them to their respective worlds:

```diff
+++ prisma/schema.prisma
  model World {
    id         Int    @id
    name       String @unique
    population Float
+   moons      Moon[]
  }

+ model Moon {
+   id    Int    @id
+   name  String
+   world World
+ }
```

`nexus` reacts to changes in your Prisma schema. By saving the above, your dev database will be automatically migrated and photon regenerated. You literally now just move on to updating your GraphQL API.

## Change the API Layer

We have data about `Earth` from before, but now we need to update it with information about its moon. Instead of working with photon inside one-off scripts, lets enhance our API and make the update as if a client app were.

We're going to need to expose the `moons` world field to clients

```diff
+++ src/graphql.ts
  schema.objectType({
    name: "World",
    definition(t) {
      t.model.id()
      t.model.name()
      t.model.population()
+     t.model.moons()
    }
  })
```

Upon doing this however, we will see a warning in our dev mode logs:

```
 Warning: Your GraphQL `World` object definition is projecting a field `moons` with `Moon` as output type, but `Moon` is not defined in your GraphQL Schema
 Warning: in /Users/jasonkuhrt/foobar/src/graphql.ts:10:13

   6 definition(t) {
   7 t.model.id();
   8 t.model.name();
   9 t.model.population();
 → 10 t.model.moons();
```

The feedback is pretty clear already but to restate: The problem is that we're project a Prisma model field (`moons`) that is a connection to another Prisma model (`Moon`) that has not been projected on our API layer. So let's do that now:

```diff
+++ src/graphql.ts
+schema.objectType({
+  name:'Moon',
+  definition(t){
+    t.model.id()
+    t.model.name()
+    t.model.world()
+   }
+})
```

Do not copy-paste. Instead type this out yourself and take note how autcompletion within the `definition` block on `t.model` effectively guides you to success.

Once you have projected `Moon` from your data layer to your API layer, you will see that the dev mode warning and TypeScript error are now resolved. 🙌

## Add Some CRUD

If you go to your GraphQL Playground now you will see that your GraphQL schema now contains your Moon data shape too. But of course we still need to update `Earth` with data about _its_ moon. To achieve that we're going to expose CRUD actions that clients can use to update `Earth`.

```diff
+++ src/graphql.ts
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
  updateOneWorld(
    where: { name: "Earth" }
    data: { moons: { create: { name: "moon" } } }
  ) {
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

We will Deploy to Heroku

For this step, create an account at [Heroku](https://www.heroku.com/) and [setup the CLI](https://devcenter.heroku.com/articles/heroku-cli).

1.  Create a new app: `heroku apps:create`
1.  Attach your project to the app: `heroku git:remote --app <app-name>`
1.  Add a postgres database to it: `heroku addons:create heroku-postgresql --app <app-name>`
1.  Get the postgres database credentials: `heroku pg:credentials:url --app <app-name>`
1.  Export the connection URL into your shell `export DATABASE_URL="<connection-url>"`
1.  Initialize the postgres database: `npx nexus db init`
1.  Deploy using the git push to master workflow. See your app running in the cloud!

## Next Steps

A good next step might be to read through some of the guides. Happy coding! 🙌
