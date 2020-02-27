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

One of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. A classic workhorse of debugging and development time feedback. There are a wealth of specialized tools but a great logging strategy can take you far. Nexus gives you a logging system built for a modern cloud native environment.

We have our own logger but write to [`pino`](https://github.com/pinojs/pino) under the hood for its performance.

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

Add context to the logger. All subsequent logs will have this information included in them within the `context` property.

### `child`

Create a new logger that inherits its parents' context.

Context added by children is never visible to parents.

Context added by children is deeply merged with the context inherited from parents.

Context added to parents is immediately visible to all existing children.

## Server

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fserver) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeature) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+)

Use this to run your HTTP server that clients will connect to. The default server is an instance of [`express-graphql`](https://github.com/graphql/express-graphql).

### `custom`

todo

### `start`

Make the server start listening for incoming client connections.

Calling start while already started is a no-op.

Normally you should not need to use this method. When your app does not call `server.start`, Nexus will do so for you automatically.

### `stop`

Make the server stop listening for incoming client connections.

Calling stop while the server is already stopped is a no-op.

Normally you should not need to use this method.

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

Should logs be logged with rich color and formatting (`true`), or as JSON (`false`)?

**Default**

`true` in dev, `false` otherwise.
