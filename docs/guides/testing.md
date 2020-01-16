Testing is a first-class concern of `santa`. So far we ship a few primitives to help you run integration tests, but you can expect integrated higher level testing features in the future.

> Note: This guide is written using [`jest`](https://jestjs.io/) because it is what we use internally and thus can speak to best. But you should be able to use your test framework of choice.

## Meet the Module

`santa` comes with a special testing module that you can import from `graphql-santa/testing`. Its primary utility is the `createTestContext` function. It is designed for running _integration_ tests. When run it will in turn boot your app (in the same process) and expose an interface for your tests to interact with it.

<!-- TODO would be nice to have the TS type shown here. Use doc extraction system to do this. -->

> For the curious...  
> Since `jest` runs test suites in parallel it means multiple instances of your `app` will be run in parallel too. The testing module takes care of abstracting the mechanics of making this work from you. For example it assigns random ports to each app to run its server and makes sure each test suite's app client is configured to be talking with its respective app instance. You should _never_ have to think about these kinds of details though, and if it turns out you do please open a GitHub issue so we can try to seal the leak you've found in `santa`'s abstraction!

##### A Little Helper {docsify-ignore}

Before jumping into test suites we will wrap the `createTestContext` with a pattern that more tightly integrates it into `jest`. `santa` will probably ship something like as follows or better in the future, but for now you can copy this into your projects:

```ts
// tests/__helpers.ts
import { createTestContext, TestContext } from 'graphql-santa/testing'

export function createTestContext(): TestContext {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestContext()
    await ctx.app.server.start()
  })

  afterAll(async () => {
    await ctx.app.server.stop()
  })

  return ctx
}
```

We'll use this in other test suites roughly like so:

```ts
// tests/foo.spec.ts
import { createTestContext } from './__helpers'

const ctx = createTestContext()

it('foo', () => {
  // use `ctx` in here
})
```

Removing boilerplate away from your test code is a win and staying DRY about it across multiple test suites helps. But do note that `ctx` is not usable outside of jest blocks (`it` `before` `after` `...`). If you try to you'll find it to be `undefined`.

```ts
import { createTestContext } from './__helpers'

const { app } = createTestContext() // Error!
```

## Without a database

**Example**

```ts
import { createTestContext } from './__helpers'

const ctx = createTestContext()

it('makes sure a user was registered', async () => {
  // ctx.app.query sends requests to your locally running santa server
  const result = await ctx.app.query(`
    mutation {
      signupUser(data: { email: "person@email.com", password: "123456" })
    } {
      id
      email
      password
    }
  `)

  const createdUsers = await ctx.app.query(`{ users { id } }`)
  expect(createdUsers).toMatchSnapshot()
})
```

## With a database (via Prisma)

> Note: This assumes you have [setup a PostgreSQL database](references/recipes?id=local-postgresql). You could use any database supported by Prisma though.

1. Install the following dev dependencies.

   ```cli
   npm install --save-dev nanoid pg jest-environment-node jest ts-jest
   ```

1. Copy & paste the following jest environment into a file called `prisma-test-environment.js` at the root of your project directory.

   ```ts
   const { Client } = require('pg')
   const NodeEnvironment = require('jest-environment-node')
   const nanoid = require('nanoid')
   const util = require('util')
   const exec = util.promisify(require('child_process').exec)

   const santaBinary = './node_modules/.bin/graphql-santa'

   /**
    * Custom test environment for graphql-santa and Postgres
    */
   class PrismaTestEnvironment extends NodeEnvironment {
     constructor(config) {
       super(config)

       // Generate a unique schema identifier for this test context
       this.schema = `test_${nanoid()}`

       // Generate the pg connection string for the test schema
       this.connectionString = `postgres://postgres:postgres@localhost:5432/testing?schema=${this.schema}`
     }

     async setup() {
       // Set the required environment variable to contain the connection string
       // to our database test schema
       process.env.POSTGRES_URL = this.connectionString
       this.global.process.env.POSTGRES_URL = this.connectionString

       // Run the migrations to ensure our schema has the required structure
       await exec(`${santaBinary} db migrate apply -f`)

       return super.setup()
     }

     async teardown() {
       // Drop the schema after the tests have completed
       const client = new Client({
         connectionString: this.connectionString,
       })
       await client.connect()
       await client.query(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`)
       await client.end()
     }
   }

   module.exports = PrismaTestEnvironment
   ```

1. Edit the `connectionString` if needed to your own postgres testing instance.

1. Create a `jest.config.ts` file in the root of your project directory and add the following content.

   ```ts
   const { join } = require('path')

   module.exports = {
     preset: 'ts-jest',
     rootDir: 'tests',
     testEnvironment: join(__dirname, 'prisma-test-environment.js'),
   }
   ```

1. Edit your `schema.prisma` file to use an environment variable.

   ```diff
   +++ schema.prisma
   datasource db {
     provider = "postgresql"
   -  url      = "postresql://..."
   +  url      = env("POSTGRES_URL")
   }
   ```

1. Create a `.env` file at the root of your project directory and add the following.

   ```
   POSTGRES_URL="<your-development-postgres-url>"
   ```

1. Create your test.

   ```ts
   // tests/user.test.ts

   import { createTestContext } from './__helpers'

   const ctx = createTestContext()

   it('makes sure a user was registered', async () => {
     // ctx.app.query sends requests to your locally running santa server
     const result = await ctx.app.query(`
       mutation {
         signupUser(data: { email: "person@email.com", password: "123456" })
       } {
         id
         email
         password
       }
     `)

     const createdUsers = await ctx.app.query(`{ users { id } }`)
     expect(createdUsers).toMatchSnapshot()
   })
   ```

1. Run it

   ```cli
   yarn jest
   ```
