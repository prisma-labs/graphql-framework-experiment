# `/testing`

## `createTestContext`

Setup a test context providing utilities to query against your GraphQL API.

This context can be augmented by plugins.

##### Signature

```ts
function createTestContext(opts?: CreateTestContextOptions): Promise<TestContext>
```

##### Example With Jest

```ts
import { TestContext, createTestContext } from 'nexus/testing'

let ctx: TestContext

beforeAll(async () => {
  Object.assign(ctx, await createTestContext())
  await ctx.app.start()
})

afterAll(async () => {
  await ctx.app.stop()
})

test('hello', async () => {
  const result = await ctx.query(`{ hello }`)

  expect(result).toMatchInlineSnapshot()
})
```

## `I` CreateTestContextOptions

```ts
export interface CreateTestContextOptions {
  /**
   * A path to the entrypoint of your app. Only necessary if the entrypoint falls outside of Nexus convention.
   * You should typically use this if you're using `nexus dev --entrypoint` or `nexus build --entrypoint`.
   */
  entrypointPath?: string
}
```

## `I` `TestContext`

```ts
export interface TestContext {
  app: {
    query: <T = any>(query: string, variables: Record<string, any>): Promise<T>
    server: {
      start: () => Promise<void>
      stop: () => Promise<void>
    }
  }
}
```
