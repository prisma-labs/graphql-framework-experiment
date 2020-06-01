So far you've been validating your work by manual interacting with the Playground. That might be reasonable at first (depending on your relationship to TDD) but it will not scale. At some point you are going to want automated testing. So in this chapter you're going to add some automated tests to your e-commerce project. You'll learn about:

- Nexus' approach to testing
- Setting up a test environment
- The `nexus/testing` module

There are multiple ways you can test a GraphQL API. One way is to extract resolvers into isolated functions and then unit test them. Of course these are rarely pure functions so those unit tests either become partial integration tests or mocks are introduced to try and retain the unit level of testing. Unit testing resolvers can work well, but here are some reasons why and where it might not;

- The Nexus Prisma plugin (discussed later) can remove the need to even write resolvers in which case testing [those] resolvers doesn't make sense.
- Thanks to the enhanced static type safety brought by Nexus, testing for correct handling of different input types and expected output types can be greatly reduced. For example you shouldn't need to test that your resolver checks for nulls before accessing nullable fields of an input object. And you don't need to test that your resolver is returning the right type.
- Unit testing resolvers cannot provide a client perspective view of correctness since they focus on internals. If you want to test but have limited time/capacity to do so, you might choose to minimize/forgo the unit level in favor of system/integration tests that are closer to or at the level of a client perspective.

Testing non-trivial resolvers in isolation is likely to be a good investment in most cases but its up to you as a developer. What Nexus provides help with is not at this level, but higher up in the testing pyramid, at the system level. System testing means tests that will run operations against your API just like a real client would. This chapter will focus on that. Let's dive-in!

## Setting up your test environment

During this tutorial, you'll use the [Jest testing framework](https://jestjs.io/) to test your API. This is not mandatory but we do recommend it. Still, in general, outside this tutorial, if you prefer another testing framework, feel free to use it.

First, install `jest` and accompanying tools

```bash
npm add --save-dev jest @types/jest ts-jest
```

Then, configure jest and npm scripts in your `package.json`

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node"
}
```

Finally, create a `tests` folder at the root of your project and a `Order.test.ts` file inside it

```bash
mkdir tests && touch tests/Order.test.ts
```

You're set.

## Testing the `checkout` mutation

Nexus comes with a special testing module that you can import from `nexus/testing`.

Its primary export is the `createTestContext` function which is designed for running system tests. When run, it will boot your app in the same process as the test suite and expose an interface for your tests to interact with it. Jest runs each test suite in its own process, so if you have have say eight test suites running in parallel that means you'll have eight app processes running too.

Before jumping into your first test we will show you a pattern that more tightly integrates `createTestContext` into jest. Nexus will probably ship something like as follows or better in the future, but for now you can just add this as test helper in your Nexus projects.

Create a `tests/__helpers.ts` module with the following contents.

```bash
touch tests/__helpers.ts
```

```tsx
// tests/__helpers.ts                                      // 1

import { createTestContext as originalCreateTestContext, TestContext } from 'nexus/testing'

export function createTestContext() {
  let ctx = {} as TestContext // 2

  beforeAll(async () => {
    Object.assign(ctx, await originalCreateTestContext()) // 3
    await ctx.app.start() // 4
  })

  afterAll(async () => {
    await ctx.app.stop() // 5
  })

  return ctx
}
```

Dissecting this helper:

1. The module name prefix `__` matches that of jest's for snapshot folders `__snapshots__`
2. Create an object that will be returned immediately but mutated before tests run
3. Before tests run create the test context. This does most of the work like getting your app instance.
4. Before tests run start the app
5. After tests complete, stop the app. This will for example close your app's HTTP server.

Alright, now you will test your checkout mutation. Use your new helper and scaffold your first test, `"ensures that checkout creates an order"` .

```tsx
// tests/Order.test.ts

import { createTestContext } from './__helpers'

const ctx = createTestContext()

it('ensures that checkout creates an order', async () => {
  // use `ctx` in here
})
```

The test context exposes a GraphQL client at `ctx.app.query` that will help us run operations against our API. We'll use it now to ensure that an order is properly created when a user checks out. Do you remember the query that you manually tested at the end of the last chapter?

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

Use that now as input into `ctx.app.query`. Then, snapshot its output. Simple! Like this:

```tsx
// tests/Order.test.ts

import { createTestContext } from './__helpers'

const ctx = createTestContext()

it('ensures that an order is created', async () => {
  const result = await ctx.app.query(`
    mutation {
      checkout(
        items: [{
          productId: 1,
          quantity: 3
        }]
      ) {
        id
        items {
          id
          productName
          productPrice
          quantity
        }
        total
      }
    }
  `)

  expect(result).toMatchInlineSnapshot()
})
```

You can now run your test using this command:

```bash
npm run test
```

Your inline snapshot should get populated with the response data, changing your test to now look like so:

(**TODO: fix `nexus/testing` module and update the snippet below with the actual snaphot)**

```bash
  expect(result).toMatchInlineSnapshot(``);
```

There's a couple of things you've just implicitly tested and some that you haven't.

Tested:

- That an order is properly created
- That the individual price of each items is correct
- That the total price of your order is correct

Not Tested:

- That the order and order items are properly persisted in your database.

About testing whether the data is properly persisted, don't worry, we'll get to that very soon. In fact, the next chapter is about persisting your data in a real database. See you there!
