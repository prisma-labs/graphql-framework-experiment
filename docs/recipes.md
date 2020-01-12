## Add Prisma

Prisma Framework is a next-generation developer-centric tool chain focused on making the data layer easy. In turn, `graphql-santa` makes it easy to integrate Prisma Framework into your app.

1. Install the prisma plugin

   ```
   $ npm install graphql-santa-plugin-prisma
   ```

1. Add a `schema.prisma` file. Add a datasource. Here we're working with SQLite. Add photon.

   ```diff
   +++ prisma/schema.prisma
   +
   +  datasource db {
   +    provider = "sqlite"
   +    url      = "file:dev.db"
   +  }
   +
   +  generator photonjs {
   +    provider = "photonjs"
   +  }
   ```

1. Initialize your database

   ```
   $ npx santa db init
   ```

1. Done. Now your app has:

   1. Functioning `$ santa db`
   2. `nexus-prisma` Nexus plugin allowing e.g.:

      ```diff
      +++ src/schema.ts
        objectType({
          name: 'User',
          definition(t) {
      -     t.id('id)
      -     t.string('name')
      +     t.model.id()
      +     t.model.name()
          },
        })
      ```

   3. An instance of the generated Photon.JS client is a added to context under `photon` property, allowing e.g.:

      ```diff
      +++ src/schema.ts
        queryType({
          definition(t) {
            t.list.field('users', {
              type: 'User',
      -       resolve() {
      -         return [{ id: '1643', name: 'newton' }]
      +       resolve(_root, _args, ctx) {
      +         return ctx.photon.users.findMany()
              },
            })
          },
        })
      ```

   4. The TypeScript types representing your Prisma models are registered as a Nexus data source. In short this enables proper typing of `parent` parameters in your resolves. They reflect the data of the correspondingly named Prisma model.

<br>

## Local PostgreSQL

The reccommended way to run postgres locally is with docker, because it is easy flexible and reliable.

1. Start a postgres server for your app:

   ```
   docker run --detach --publish 5432:5432 --name 'postgres' postgres
   ```

2. Now you can use a connection URL like:

   ```
   postgresql://postgres:postgres@localhost:5432/myapp
   ```

If you don't want to use a docker, here are some links to alternative approaches:

- [With Homebrew](https://wiki.postgresql.org/wiki/Homebrew)

<br>

## Go to proudction

1. Add a build script

   ```diff
   +++ package.json
   + "build": "santa build"
   ```

2. Add a start script

   ```diff
   +++ package.json
   + "start": "node node_modules/.build"
   ```

3. In many cases this will be enough. Many deployment platforms will call into these scripts by default. You can customize where `build` outputs to if your deployment platform requires it. There are built in guides for `zeit` and `heroku` which will check your project is prepared for deployment to those respective platforms. Take advantage of them if applicable:

   ```diff
   +++ package.json
   + "build": "santa build --deployment now"
   ```

   ```diff
   +++ package.json
   + "build": "santa build --deployment heroku"
   ```

<br>

## Prisma + Heroku + PostgreSQL

1. Confirm the name of the environment variable that Heroku will inject into your app at runtime for the database connection URL. In a simple setup, with a single attached atabase, it is `DATABASE_URL`.
1. Update your Prisma Schema file to get the database connection URL from an environment variable of the same name as in step 1. Example:

   ```diff
   --- prisma/schema.prisma
   +++ prisma/schema.prisma
     datasource postgresql {
       provider = "postgresql"
   -   url      = "postgresql://<user>:<pass>@localhost:5432/<db-name>"
   +   url      = env("DATABASE_URL")
     }
   ```

1. Update your local development environment to pass the local development database connection URL via an environment variable of the same name as in step 1. Example with [direnv](https://direnv.net/):

   1. Install `direnv`

      ```
      $ brew install direnv
      ```

   1. Hook `direnv` into your shell ([instructions](https://direnv.net/docs/hook.html))
   1. Setup an `.envrc` file inside your project

      ```diff
      +++ .envrc
      + DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"
      ```

   1. Approve the `.envrc` file (one time, every time the envrc file changes).
      ```
      $ direnv allow .
      ```
   1. Done. Now when you work within your project with a shell, all your commands will be run with access to the environment variables defined in your `.envrc` file. The magic of `direnv` is that these environment variables are automatically exported to and removed from your environment based on you being within your prject directory or not.
