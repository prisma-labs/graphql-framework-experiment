Testing is a critical part of `graphql-santa`. We provided first-class utilities to help you perform integration testing against your GraphQL API with ease.

> Note: We recommend using `jest` to perform your tests. While we theoretically support most testing libraries, we have only tested it with `jest`. Consequently, all the examples below are using `jest`.

## Without a database

```ts
import { createTestContext, TestContext } from 'graphql-santa/testing'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()

  await ctx.app.server.start()
})

afterAll(async () => {
  await ctx.app.server.stop()
})

it('makes sure a user was registered', async () => {
  /**
   * ctx.app.query sends request against your local graphql-santa server
   */
  const result = await ctx.app.query(`mutation {
    signupUser(data: { email: "person@email.com", password: "123456" })
  } {
    id
    email
    password
  }`)

  const createdUsers = await ctx.app.query(`{ users { id } }`)

  expect(createdUsers.length).toEqual(1)
})
```

## With a database (prisma)

### With postgres

> Note: This assumes you have setup a PostgreSQL database

1. Install the following dev dependencies

```
npm install --save-dev nanoid pg jest-environment-node jest ts-jest
```

2. Copy & paste the following jest environment into a file called `prisma-test-environment.js` at the root of your project directory

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

3. Edit the `connectionString` if needed to your own postgres testing instance

4. Create a `jest.config.ts` file in the root of your project directory and add the following content

```js
const { join } = require('path')

module.exports = {
  preset: 'ts-jest',
  rootDir: 'tests',
  testEnvironment: join(__dirname, 'prisma-test-environment.js'),
}
```

5. Edit your `schema.prisma` file to use an environment variable

```diff
datasource db {
   provider = "postgresql"
-  url      = "postresql://..."
+  url      = env("POSTGRES_URL")
}
```

6. Create a `.env` file at the root of your project directory and add the following

```
POSTGRES_URL="<your-development-postgres-url>"
```

7. Create a `tests/` folder at the root of your project directory

8. Create your test

```ts
// tests/user.test.ts

import { createTestContext, TestContext } from 'graphql-santa/testing'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestContext()

  await ctx.app.server.start()
})

afterAll(async () => {
  await ctx.app.server.stop()
  await ctx.app.db.client.disconnect()
})

it('makes sure a user was registered', async () => {
  /**
   * ctx.app.query sends request against your local graphql-santa server
   */
  const result = await ctx.app.query(`mutation {
    signupUser(data: { email: "person@email.com", password: "123456" })
  } {
    id
    email
    password
  }`)

  const createdUsers = await ctx.app.query(`{ users { id } }`)

  expect(createdUsers.length).toEqual(1)
})
```

9. Run jest

```
yarn jest
```
