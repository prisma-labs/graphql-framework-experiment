## `app`

A singleton nexus-future app. Use this to build up your GraphQL schema and configure your server.

**Example**

```ts
// schema.ts

import { app } from 'nexus-future'

app.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

### `app.addToContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addToContext`.

**Example**

```ts
// app.ts

import { app } from 'nexus-future'

app.addToContext(req => {
  return {
    foo: 'bar',
  }
})

app.objectType({
  name: 'Foo',
  definition(t) {
    t.string('foo', (_parent, _args, ctx) => ctx.foo)
  },
})
```

### `app.<nexusDefBlock>`

Add types to your GraphQL Schema. The available nexus definition block functions include `objectType` `inputObjectType` `enumType` and so on. Refer to the [official Nexus API documentation](https://nexus.js.org/docs/api-objecttype) for more information about these functions.

**Example**

```ts
// schema.ts

import { app } from 'nexus-future'

app.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

### `app.logger`

An instance of [`RootLogger`](#rootlogger).

**Example**

```ts
// app.ts

import { app } from 'nexus-future'

app.logger.info('boot')
```

### `app.server`

An instance of [`Server`](#server).

Framework Notes:

- If your app does not call `app.server.start` then `nexus-future` will. It is idiomatic to allow `nexus-future` to take care of this. If you deviate, we would love to learn about your use-case!

## `Server`

TODO

### `server.start`

### `serve.stop`

## `Logger`

TODO

### `.create`

### `logger.fatal`

### `logger.error`

### `logger.warn`

### `logger.info`

### `logger.debug`

### `logger.trace`

### `logger.addToContext`

### `logger.child`

## `RootLogger`

TODO

Extends [`Logger`](#logger)

### `rootLogger.settings`
