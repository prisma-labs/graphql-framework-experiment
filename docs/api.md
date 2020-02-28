The main module exports an application singleton. It is available as the default export. For convenience you can import the app components as named exports too.

**Example of importing default export**

```ts
import app from 'nexus-future'

app.log.info('hello world')

app.settings.change({
  server: {
    port: 5689,
  },
})

app.schema.queryType({
  definition(t) {
    t.field('foo', { type: 'String' })
  },
})

app.server.start()
```

**Example of imporrting named exports**

```ts
import { schema, server, settings, log } from 'nexus-future'

log.info('hello world')

settings.change({
  server: {
    port: 5689,
  },
})

schema.queryType({
  definition(t) {
    t.field('foo', { type: 'String' })
  },
})

server.start()
```

## Schema

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fgql) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Ffeature) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Fbug+)

Use this to model your domain, all the data that your API will accept and return, and how all the various objects in the domain relate to one another (the "graph" in "GraphQL").

### `objectType`

[GraphQL Docs for Object Types](https://graphql.org/learn/schema/#object-types-and-fields)

The most basic components of a GraphQL schema are object types, a type you can
fetch from your schema, with fields:

**Signature**

```ts
objectType(typeName: string, fn: ObjectDefinitionBlock): NexusObjectType
```

**Example**

```ts
import { schema } from 'nexus-future'

schema.objectType({
  name: 'User',
  definition(t) {
    t.int('id', { description: 'Id of the user' })
    t.string('fullName', { description: 'Full name of the user' })
    t.field('status', { type: 'StatusEnum' })
    t.list.field('posts', {
      type: Post, // or "Post"
      resolve(root, args, ctx) {
        return ctx.getUser(root.id).posts()
      },
    })
  },
})

schema.objectType({
  name: 'Post',
  definition(t) {
    t.int('id')
    t.string('title')
  },
})

schema.enumType({
  name: 'StatusEnum',
  members: {
    ACTIVE: 1,
    DISABLED: 2,
  },
})
```

`queryType` / `mutationType` are shorthand for the root types.

### `enumType`

[GraphQL Docs for Enum Types](https://graphql.org/learn/schema/#enumeration-types)

Defining as an array of enum values:

```ts
import { schema } from 'nexus-future

const Episode = schema.enumType({
  name: 'Episode',
  members: ['NEWHOPE', 'EMPIRE', 'JEDI'],
  description: 'The first Star Wars episodes released',
})
```

As an object, with a simple mapping of enum values to internal values:

```ts
import { schema } from 'nexus-future'

const Episode = schema.enumType({
  name: 'Episode',
  members: {
    NEWHOPE: 4,
    EMPIRE: 5,
    JEDI: 6,
  },
})
```

### `inputObjectType`

[GraphQL Docs for Input Object Types](https://graphql.org/learn/schema/#input-types)

Defines a complex object which can be passed as an input value.

**Example**

```ts
import { schema } from 'nexus-future'

schema.inputObjectType({
  name: 'InputType',
  definition(t) {
    t.string('key', { required: true })
    t.int('answer')
  },
})
```

Unlike object types, input types do not have arguments, so they do not have resolvers or "backing types"

### `interfaceType`

[GraphQL Docs for Interface Types](https://graphql.org/learn/schema/#input-types)

In Nexus, you do not need to redefine the interface fields on the
implementing object types, instead you may use `.implements(interfaceName)`
and all of the interface fields will be added to the type.

**Example**

```ts
import { schema } from 'nexus-future'

schema.interfaceType({
  name: 'Node',
  definition(t) {
    t.id('id', { description: 'GUID for a resource' })
  },
})

schema.objectType({
  name: 'User',
  definition(t) {
    t.implements('Node')
  },
})
```

If you need to modify the description or resolver defined by an interface, you can call the `modify` method on `objectType` to change these after the fact.

### `scalarType`

[GraphQL Docs for Scalar Types](https://graphql.org/learn/schema/#scalar-types)

Nexus allows you to provide an `asNexusMethod` property which will make the scalar available as a builtin on the definition block object. We automatically generate and merge the types so you get type-safety just like the scalar types specified in the spec:

**Example**

```ts
import { schema } from 'nexus-future'

schema.scalarType({
  name: 'Date',
  asNexusMethod: 'date',
  description: 'Date custom scalar type',
  parseValue(value) {
    return new Date(value)
  },
  serialize(value) {
    return value.getTime()
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(ast.value)
    }
    return null
  },
})
```

**Example of Upload scalar**

```ts
import { GraphQLUpload } from 'graphql-upload'

export const Upload = GraphQLUpload
```

**Example of DateTime scalar**

```ts
import { GraphQLDate } from 'graphql-iso-date'

export const DateTime = GraphQLDate
```

**Example of exposing scalar as builder method**

If you have an existing GraphQL scalar and you'd like to expose it as a builder method, call `asNexusMethod`:

```ts
import { schema } from 'nexus-future'
import { GraphQLDate } from 'graphql-iso-date'

schema.asNexusMethod(GraphQLDate, 'date')

schema.objectType({
  name: 'SomeObject',
  definition(t) {
    t.date('createdAt') // t.date() is now available (with types!) because of `asNexusMethod`
  },
})
```

### `unionType`

[GraphQL Docs for Union Types](https://graphql.org/learn/schema/#union-types)

Union types are very similar to interfaces, but they don't get to specify any
common fields between the types.

**Example**

```ts
import { schema } from 'nexus-future'

schema.unionType({
  name: 'MediaType',
  description: 'Any container type that can be rendered into the feed',
  definition(t) {
    t.members('Post', 'Image', 'Card')
    t.resolveType(item => item.name)
  },
})
```

### `arg`

[GraphQL Docs on Arguments](https://graphql.org/learn/schema/#arguments)

**Example**

Defines an argument that can be used in any object or interface type. Args can be reused in multiple locations, and it can be convenient to create your own wrappers around arguments.

```ts
import { schema } from 'nexus-future'
import { ScalarArgConfig } from 'nexus-future/types'

function requiredInt(opts: ScalarArgConfig<number>) {
  return schema.arg({ ...opts, required: true, type: 'Int' })
}
```

Options available are:

**Type**

The type of the argument.

Format: `type: 'Boolean' | 'Float' | 'Int' | 'String' | 'ID'`

**Required**

Whether the argument is required or not.

Format: `required?: boolean;`

Note, when `required: true`, `nullable: false`

&nbsp;

**Nullable**

Whether the argument is nullable or not.

Format: `nullable?: boolean;`

Note, when `nullable: true`, `required: false`

&nbsp;

**List**

Whether the argument is a list or not.

Format: `list?: null | true | boolean[];`

null = not a list

true = list

array = nested list, where true/false decides whether the list member can be nullable

&nbsp;

**Description**

The description to annotate the GraphQL SDL

Format: `description?: string | null;`

### `intArg`

Sugar for creating arguments of type `Integer`.

### `stringArg`

Sugar for creating arguments of type `String`.

### `floatArg`

Sugar for creating arguments of type `Float`.

### `idArg`

Sugar for creating arguments of type `ID`.

### `booleanArg`

Sugar for creating arguments of type `Boolean`.

### `t.connection`

todo

### `addToContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addToContext`.

**Example**

```ts
import { schema } from 'nexus-future'

schema.addToContext(_req => {
  return {
    greeting: 'Howdy!',
  }
})

schema.queryType({
  definition(t) {
    t.string('hello', {
      resolve(_root, _args, ctx) {
        return ctx.greeting
      },
    })
  },
})
```

## Logger

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Flogger) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Ffeature) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Fbug+)

Logging is one of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. It is a classic workhorse of debugging and development time feedback. There are a wealth of specialized tools but a great logging strategy can take you far. Nexus gives you a logging system built for a modern cloud native environment.

It is recommended that your app only sends to stdout via the Nexus logging system. This ensures that you maintain log level control and are always working with JSON. We work hard to make the logger so good that you'll to use it.

All logs are sent to stdout (not stderr). Logs are formatted as JSON but there is a pretty mode for development.

**Signature**

```ts
<logLevel>(event: string, context?: Record<string, unknown>) => void
```

- `event`

  The event name of this log. Maps to the `event` property in the output JSON.

  **Remarks**

  The log api is designed to get you thinking about logs in terms of events with structured data instead of strings of interpolated data. This approach gets you significantly more leverage out of your logs once they hit your logging platform, e.g. [ELK](https://www.elastic.co/what-is/elk-stack)

- `context`

  Contextual information about this log. The object passed here is deeply merged under the log's `context` property.

  **Example**

  ```ts
  log.info('hello', { user: 'Toto' }) // { "context": { "user": "Toto"  }, ... }
  ```

**Example**

```ts
import { log } from 'nexus-future'

log.info('hello')
```

### JSON Log

**Type**

```ts
{
  level: 10 | 20 | 30 | 40 | 50
  time: number
  pid:number
  hostname:string
  path: string[]
  context: JSON
  event: string
}
```

- `level` - Numeric representation of log levels. Numeric because it easy later to filter e.g. level `30` and up. `10` is `trace` while on the other end of the scale `50` is `fatal`.

- `time` - Unix timestamp in milliseconds.

- `pid` - The process ID given by the host kernal.

- `hostname` - The machine host (`require('os').hostname()`)

- `path` - The fully qualified name of the logger.

  **Example**

  ```ts
  import { log } from 'nexus-future'

  log.info('hi') //              { path: ['nexus'], ... }
  log.child('b').info('hallo') // { path: ['nexus', 'b'], ... }
  ```

- `context` - Custom contextual data added by you. Any data added by the log call, previous `addToContext` calls, or inheritance from parent context.

- `event` - The name of this log event.

**Example**

```json
{
  "path": ["nexus", "dev", "watcher"],
  "event": "restarting",
  "level": 30,
  "time": 1582856917643,
  "pid": 49426,
  "hostname": "Jasons-Prisma-Machine.local",
  "context": {
    "changed": "api/graphql/user.ts"
  }
}
```

### `fatal`

Log something at `fatal` level.

### `error`

Log something at `error` level.

### `warn`

Log something at `warn` level.

### `info`

Log something at `info` level.

### `debug`

Log something at `debug` level.

### `trace`

Log something at `trace` level.

### `addToContext`

Add context to the logger. All subsequent logs will have this information included under their `context` property. Data is merged deeply using [lodash merge](https://lodash.com/docs/4.17.15#merge).

Use this if you have some information that you wish all logs to include in their context.

**Signature**

<!-- prettier-ignore -->
```ts
(context: Record<string, unknown>) => Logger
```

**Example**

```ts
log.addToContext({ user: 'Toto' })
log.info('hello')
log.warn('bye')
// { "context": { "user": "Toto"  }, "event": "hello", ... }
// { "context": { "user": "Toto"  }, "event": "bye", ... }
```

**Example of local scalar precedence**

```ts
log.addToContext({ user: { name: 'Toto', age: 10 })
log.info("hi", { user: { name: 'Titi', heightCM: 155 })
// { "context": { "user": { "name": "Titi", age: 10, heightCM: 155 }}, ... }
```

### `child`

Create a new logger that inherits its parents' context and path.

Context added by children is never visible to parents.

Context added by children is deeply merged using [lodash merge](https://lodash.com/docs/4.17.15#merge) with the context inherited from parents.

Context added to parents is immediately visible to all existing children.

**Signature**

<!-- prettier-ignore -->
```ts
(name: string) => Logger
```

**Example**

```ts
log.addToContext({ user: 'Toto' })

const bar = log.child('bar').addToContext({ bar: 'bar' })
const foo = log.child('foo').addToContext({ foo: 'foo' })

log.info('hello')
bar.info('bar')
foo.info('foo')

// { "context": { "user": "Toto"  }, path: ["app"], "event": "hello", ... }
// { "context": { "user": "Toto", "bar": "bar"  }, path: ["app", "bar"], "event": "bar", ... }
// { "context": { "user": "Toto", "foo": "foo"  }, path: ["app", "foo"], "event": "foo", ... }
```

**Remarks**

You can create child loggers recursively starting from the root logger. A child logger extends their parent's component path and inherits their parent's context. Children can add context that is visible to themselves and their descedents.

Child loggers are useful when you want to pass a logger to something that should be tracked as its own subsystem and/or may add context that you want isolated from the rest of the system. For example a classic use-case is the logger-instance-per-request pattern where a request-scoped logger is used for all logs in a request-response code path. This makes it much easier in production to group logs in your logging platform by request-response lifecycles.

All runtime logs in your app (including from plugins come from either the `logger` itself or descendents thereof. This means if you wish absolutely every log being emitted by your app to contain some additional context you can do so simply by adding context to the root logger.

## Server

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fserver) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeature) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+)

Use this to run your HTTP server that clients will connect to. The default server is an instance of [`express-graphql`](https://github.com/graphql/express-graphql).

### `start`

Make the server start listening for incoming client connections.

Calling start while already started is a no-op.

Normally you should not need to use this method. When your app does not call `server.start`, Nexus will do so for you automatically.

### `stop`

Make the server stop listening for incoming client connections.

Calling stop while the server is already stopped is a no-op.

Normally you should not need to use this method.

### `custom`

Augment or replace the default server implentation.

**Signature**

<!-- prettier-ignore -->
```ts
(customizerLens: { express: Express, schema: GraphQLSchema, context: ContextCreator }) => MaybePromise<void | ServerReplacement>
```

- param `customizerLens`

  Useful for Augmentation:

  - `express` – A reference to the Express [`App`](http://expressjs.com/en/4x/api.html#app) instance. Accessing this property will trigger express app instantiation. Avoid this if you are intending to _replace_ the server implementation completely. Lazy instantiation is used so that that your app does not pay an express app performance penalty if you are not using it.

  Useful for Replacement:

  - `schema` – An instance of [GraphQLSchema](https://graphql.org/graphql-js/type/#graphqlschema) from `graphql` package. The result of `makeSchema` from `@nexus/schema`.

  - `context` – The context creator for the app. This is a bundle of all the app's (`addToContext`) and plugins' context contributions. If you are replacing the server, you must invoke this function on every incoming request with the request object, and then thread the returned context data to your resolver execution. If you are using a high level server library like `apollo-server` or `fastify-gql` then all you should ahve to do is pass this function along to them (see example below).

    > Warning [#424](https://github.com/graphql-nexus/nexus-future/issues/424)  
    > Currently, context contributors work directly against the Express [Request object](http://expressjs.com/en/4x/api.html#req). This means if your custom implementation calls the context creator with an incompatible request object, they context contributors may encounter runtime errors.

* return `void` – This means the default implementation, an express server, will be used. Presumably you are just accessing the `express` property and augmenting the express instance.

* return `ServerReplacement` – This means the default implementation, an express server, will be replaced. You need only teach Nexus how to start and stop your custom server. Refer to docs `server.start` and `sever.stop` for what you must provide.

* return `Promise<void | ServerRepalcement>` – If you need to do async work.

**Example of augmenting the Express server ([Repo](https://github.com/prisma-labs/nexus-future-examples/tree/master/custom-server))**

```ts
import cors from 'cors'
import { server } from 'nexus-future'

server.custom(({ express }) => {
  express.use(cors())
})
```

**Example of replacing the express server with another ([Repo](https://github.com/prisma-labs/nexus-future-examples/tree/master/custom-server-fastify-gql))**

```ts
import Fastify, { FastifyRequest } from 'fastify'
import FastifyGQL from 'fastify-gql'
import { schema, server, settings, log } from 'nexus-future'

server.custom(({ schema, context }) => {
  const app = Fastify()

  app.register(FastifyGQL, {
    schema,
    context,
    ide: 'playground',
  })

  return {
    async start() {
      await app.listen(settings.current.server.port)

      log.info(`listening`, {
        initialConfig: app.initialConfig,
        url: `http://localhost:${settings.current.server.port}/playground`,
      })
    },
    stop() {
      return app.close()
    },
  }
})

schema.addToContext<FastifyRequest>(_req => {
  return {
    db: {
      users: {
        newton: {
          id: '1',
          birthyear: '1649',
          name: 'Newton',
        },
      },
    },
  }
})
```

## Settings

### `change`

**Example**

```ts
import { settings } from 'nexus-future'

settings.change({
  server: {
    port: 9876,
  },
})
```

### `current`

A reference to the current settings object.

### `original`

A reference to the original settings object.

### Available Settings

#### `server`

##### `playground`

Should the app expose a [GraphQL Playground](https://github.com/prisma-labs/graphql-playground) to clients?

**Default**

`true` in dev, `false` otherwise.

##### `port`

The port the server should listen on.

##### `host`

The host the server should listen on.

#### `schema`

##### `connections`

todo

#### `logger`

##### `level`

The level which logs must be at or above to be logged. Logs below this level are discarded.

The level scale is:

```
fatal
critical
warn
info
debug
trace
```

**Default**

`debug` in dev, `info` otherwise.

##### `pretty`

Control if pretty mode is disabled or enabled, and how pretty mode looks.

**Type**

<!-- prettier-ignore -->
```ts
boolean | { enabled: boolean, timeDiff: boolean, color: boolean, levelLabel: boolean }
```

- object
  - `enabled` - Should logs be logged with rich formatting etc. (`true`), or as JSON (`false`)?
  - `color` - Should logs have color?
  - `timeDiff` - Should a time delta between each log be shown in the gutter?
  - `levelLabel` - Should the label of the level be shown in the gutter?
- `boolean` - Shorthand for `enabled`.

**Defaults**

- `enabled` - A dynamic process:

  - Is `LOG_PRETTY` environment variable `true`? Then `true`.
  - Is `LOG_PRETTY` environment variable `false`? Then `false`.
  - Is process.stdout attached to a TTY? Then `true`

- `color` - `true`
- `timeDiff` - `true`
- `levelLabel` - `false`

**Example of what it looks like**

```
LOG_DEMO=true npx nexus dev
```

```
-----------
LOGGER DEMO
-----------
   4 ✕ root:foo  --  lib: /see/
   0 ■ root:foo
       | har  { mar: 'tek' }
       | jar  [
       |        1, 2, 3, 4, 4, 5, 6,
       |        6, 7, 9, 1, 2, 4, 5,
       |        6, 7, 3, 6, 5, 4
       |      ]
       | kio  [Object: null prototype] [foo] {}
   1 ▲ root:foo  --  bleep: [ 1, '2', true ]
   0 ● root:foo
   1 ○ root:foo
       | results  [
       |            { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
       |            { userId: 1, id: 2, title: 'quis ut nam facilis et officia qui', completed: false },
       |            { userId: 1, id: 3, title: 'fugiat veniam minus', completed: false },
       |            { userId: 1, id: 4, title: 'et porro tempora', completed: true },
       |            {
       |              userId: 1,
       |              id: 5,
       |              title: 'laboriosam mollitia et enim quasi adipisci quia provident illum',
       |              completed: false
       |            }
       |          ]
       | tri      'wiz'
       | on       false
   0 ○ root:foo  --  foo: 'bar'
   0 — root:foo  --  a: 1  b: 2  c: 'three'
-----------
```
