## Modules

### `nexus-future`

Exports the singleton app components. Use to build up your GraphQL schema and server.

#### `schema`

An instance of [`Schema`](#schema).

**Example**

```ts
import { schema } from 'nexus-future'

schema.objectType({
  name: 'Foo',
  definition(t) {
    t.id('id')
  },
})
```

#### `logger`

An instance of [`RootLogger`](#rootlogger).

**Example**

```ts
import { logger } from 'nexus-future'

logger.info('boot')
```

#### `server`

An instance of [`Server`](#server).

**Example**

```ts
import { server } from 'nexus-future'

server.start()
```

Framework Notes:

- If your app does not call `server.start` then `nexus` will. It is idiomatic to allow `nexus` to take care of this. If you deviate, we would love to learn about your use-case!

### `nexus-future/testing`

todo

### `nexus-future/plugin`

todo

## Types

### `Schema`

#### `schema.settings`

todo

#### `schema.addToContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addToContext`.

**Example**

```ts
// app.ts

import { schema } from 'nexus-future'

schema.addToContext(req => {
  return {
    foo: 'bar',
  }
})

schema.objectType({
  name: 'Foo',
  definition(t) {
    t.string('foo', (_parent, _args, ctx) => ctx.foo)
  },
})
```

#### `schema.<nexusDefBlock>`

Add types to your GraphQL Schema. The available nexus definition block functions include `objectType` `inputObjectType` `enumType` and so on. Refer to the [official Nexus Schema API documentation](https://nexus.js.org/docs/api-objecttype) for more information about these functions.

### `Server`

TODO

#### `server.start`

#### `server.stop`

### `RootLogger`

TODO

Extends [`Logger`](#logger)

#### `rootLogger.settings`

### `Logger`

TODO

#### `.create`

#### `logger.fatal`

#### `logger.error`

#### `logger.warn`

#### `logger.info`

#### `logger.debug`

#### `logger.trace`

#### `logger.addToContext`

#### `logger.child`
