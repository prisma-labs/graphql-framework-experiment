# Schema

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fgql) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fgql+label%3Atype%2Fbug+)

Use this to model your domain, all the data that your API will accept and return, and how all the various objects in the domain relate to one another (the "graph" in "GraphQL").

### `queryType`

todo

### `mutationType`

todo

### `subscriptionType`

todo

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

#### `t.field`

todo

#### `t.string`

todo

#### `t.boolean`

todo

#### `t.int`

todo

#### `t.float`

todo

#### `t.boolean`

todo

#### `t.id`

todo

#### `t.implements`

todo

#### `t.list`

todo

#### `t.modify`

todo

#### `t.typeName`

todo

#### `t.connection`

This field builder helps you implement paginated associations between types in your schema. The contributions that it makes to your GraphQL schema adhear to the [Relay Connection Specification](https://facebook.github.io/relay/graphql/connections.htm#sec-Node). In other words it allows you the API author to write the minimum logic required to create spec-compliant relay connections for your API clients.

**Signature**

<!-- prettier-ignore -->
```ts
(
  fieldName: string,
  config: {
    type:                       GraphQLType,
    additionalArgs?:            Args
    inheritAdditionalArgs?:     boolean
    disableForwardPagination?:  boolean
    disableBackwardPagination?: boolean
    strictArgs?:                boolean
    validateArgs?:              (
                                  argsArgs: Args,
                                  info: ResolverInfo
                                ) => void
    extendConnection?:          (t: TypeBuilder) => void
    extendEdge?:                (t: TypeBuilder) => void
    pageInfoFromNodes?:         (
                                  nodes:    Node[],
                                  args:     Args,
                                  context:  Context,
                                  info:     ResolverInfo
                                ) => {
                                       hasNextPage:     boolean,
                                       hasPreviousPage: booolean
                                     }
    cursorFromNode?:            (
                                  node:    Node,
                                  args:    Args,
                                  context: Context,
                                  info:    ResolverInfo,
                                  forCursor: {
                                    index: number
                                    nodes: Node[]
                                  }
                                ) => MaybePromise<string>
  } & 
    | { nodes?:   never, resolve: Resolver } 
    | { resolve?: never, nodes: NodeResolver } 
) => void
```

- param `config`

  - `type` <code class="TypeRef" ><a href="#graphqltype">GraphQLType</a></code>  
    The type of this field.

  - `resolve` <code class="TypeRef" ><a href="#graphqltype">Resolver</a></code>  
    Implement everything yourself.

    Useful for more complex pagination cases, where you may want to use utilities from other libraries like [`graphql-relay`](https://github.com/graphql/graphql-relay-js), and only use Nexus for the construction and type-safety.

    Unlike with `nodes` approach, this approach makes no assumptions about values for the `edges` `cursor` `pageInfo` properties.

    **Optionality**

    Forbidden if `nodes` given. Required otherwise.

  - `nodes` <code class="TypeRef" ><a href="#graphqltype">NodeResolver</a></code>

    **Optionality**

    Forbidden if `resolve` given. Required otherwise.

    **Remarks**

    When you use this approach (instead of `resolve`), Nexus makes some assumptions about the structure of the connection. You are only required to return a list of nodes to resolve based on the connection, and then we will automatically infer the `hasNextPage`, `hasPreviousPage`, and `cursor` values for you.

    The returned array of nodes should have a length of one greater than the requested item count. The additional item should be placed according to this pattern:

    - paginating forward / selecting `first`: last
    - paginating backward / selecting `last`: first

    For example, if the query is paginating forward, and there are 20 nodes in the returned array:

    ```
    Query Args     Returned Nodes

    (first: 2)     [{id: 1}, {id: 2}, {id: 3}]
                                    ~~~~~~~ ------------------- Extra
    (last: 2)      [{id: 18}, {id: 19}, {id: 20}]
                   ~~~~~~~~ ------------------------------------- Extra
    ```

    Nexus then slices the array in the paginating direction, and if there are more than "N" node results, Nexus takes this to mean that there is another page in the paginating direction.

    If you set `assumeExactNodeCount` to `true` in `schema.connections` setting then this heuristic changes. Nexus then assumes that a next page exists if the returned array length is `>=` to requested node count.

  * `additionalArgs` <code class="TypeRef" ><a href="#args">Args</a></code>  
    Additional arguments to use for just this field.

    **Default**

    `undefined`

    **Remarks**

    When used, the `additionalArgs` in app settings `schema.connections` will not be inherited. If you do wish to inherit them, enable that with `inheritAdditionalArgs`.

  * `inheritAdditionalArgs`  
    Whether to inherit the `additionalArgs` from app settings `schema.connections`

    **Default**

    `true` if `additionalArgs` is not set, `false` otherwise.

  * `disableForwardPagination`  
    If `true` then `first` and `after` args are _not_ present. When disabled, `last` arg becomes required, unless you disable `strictArgs`.

    **Default**

    `false`

  - `disableBackwardPagination`  
    If `true` then `last` and `before` args are _not_ present. When disabled, `first` arg becomes required, unless you disable `strictArgs`.

    **Default**

    `false`

  - `strictArgs`  
    Whether `first`/`last` arg nullability should reflect the forward/backward pagination configuration. When `true`, then the following pattern is used:

    - when _only_ forward pagination enabled
      - meaning, `disableForwardPagination && !disableBackwardPagination`
      - then, `last` arg is required
    - when _only_ backward pagination enabled
      - meaning, `!disableForwardPagination && disableBackwardPagination`
      - then, `first` arg is required

    **Default**

    `true`

  - `validateArgs`  
    Custom logic to validate the args. Throw an error to signal validation failure.

    **Signature**

    <p class="OneLineSignature"></p>

    ```ts
    (args: Args, info: ResolverInfo) => void
    ```

    **Default**

    Validates that client passes a `first` or a `last` arg, and not both.

  - `extendConnection`
    Dynamically add additional fields to the GraphQL connection object. Similar to `extendEdge`.

    **Signature**

    <p class="OneLineSignature"></p>

    ```ts
    (t: TypeBuilder) => void
    ```

    **Default**

    `undefined`

    **Remarks**

    Because this customizes the GraphQL connection object type, the _name_ of the type will necessarially be changed as well. If it didn't, it would conflict with the non-extended connection type in your schema (if any). The following pattern will be used to name the GraphQL object type:

    <p class="OneLineSignature"></p>

    ```
    {camelCaseJoin: <typeName><fieldName>}_Connection
    ```

    **Example**

    ```ts
    schema.queryType({
      name: 'Query',
      definition(t) {
        t.connection("toto", {
          type: 'Boolean',
          extendConnection(t) {
            t.string('foo', () => 'bar')
          }
        }),
        ...
      }
    })
    ```

    ```graphql
    type QueryToto_Connection {
      edges: [BooleanEdge]
      pageInfo: PageInfo!
      foo: String!
    }
    ...
    ```

  - `extendEdge`  
    Dynamically add additional fields to the GraphQL edge object. Similar to `extendConnection`.

    **Signature**

    <p class="OneLineSignature"></p>

    ```ts
    (t: TypeBuilder) => void
    ```

    **Default**

    `undefined`

    **Remarks**

    Because this customizes the GraphQL edge object type, the _name_ of the type will necessarially be changed as well. If it didn't, it would conflict with the non-extended edge type in your schema (if any). The following pattern will be used to name the GraphQL object type:

    <p class="OneLineSignature"></p>

    ```
    {camelCaseJoin: <typeName><fieldName>}_Edge
    ```

    **Example**

    ```ts
    schema.queryType({
      name: 'Query',
      definition(t) {
        t.connection("toto", {
          type: 'Boolean',
          extendEdge(t) {
            t.string('foo', () => 'bar')
          }
        }),
        ...
      }
    })
    ```

    ```graphql
    type QueryToto_Edge {
      cursor: String!
      node: Boolean!
      foo: String!
    }
    ...
    ```

  * `pageInfoFromNodes`  
    Override the default algorithm to determine `hasNextPage` and `hasPreviousPage` page info fields. Often needed when using `cursorFromNode`. See `nodes` for what default algorithm is.

    **Signature**

    ```ts
    (
      nodes:   Node[],
      args:    Args,
      context: Context,
      info:    ResolverInfo
    ) => {
      hasNextPage:     boolean,
      hasPreviousPage: booolean
    }
    ```

    **Default**

    `undefined`

  * `cursorFromNode`
    Approach we use to transform a node into a cursor

    **Signature**

    ```ts
    (
      node:    Node,
      args:    Args,
      context: Context,
      info:    ResolverInfo,
      forCursor: {
        index: number
        nodes: Node[]
      }
    ) => MaybePromise<string>
    ```

    **Default**

    `'nodeField'`

##### SchemaContributions {docsify-ignore}

todo

##### Example of using `resolve` {docsify-ignore}

```ts
import { schema } from 'nexus-future'
import { connectionFromArray } from 'graphql-relay'

schema.queryType(t => {
  t.connection('users', {
    type: 'User',
    async resolve(root, args, ctx, info) {
      return connectionFromArray(await ctx.resolveUserNodes(), args)
    },
  })
})
```

##### Example of using `nodes` {docsify-ignore}

```ts
schema.queryType({
  definition(t) {
    t.connection('users', {
      type: 'User',
      nodes(root, args, ctx, info) {
        // [{ id: 1,  ... }, ..., { id: 10, ... }]
        return ctx.users.resolveForConnection(root, args, ctx, info)
      },
    })
  },
})
```

One limitation of the `nodes` property, is that you cannot paginate backward without a `cursor`, or without defining a `cursorFromNode` property on either the field or plugin config. This is because we can't know how long the connection list may be to begin paginating backward.

```ts
schema.queryType({
  definition(t) {
    t.connection('usersConnectionNodes', {
      type: 'User',
      cursorFromNode(node, args, ctx, info, { index, nodes }) {
        if (args.last && !args.before) {
          const totalCount = USERS_DATA.length
          return `cursor:${totalCount - args.last! + index + 1}`
        }
        return connectionPlugin.defaultCursorFromNode(node, args, ctx, info, {
          index,
          nodes,
        })
      },
      nodes() {
        // ...
      },
    })
  },
})
```

##### Example of using `additionalArgs` {docsify-ignore}

```ts
schema.queryType({
  definition(t) {
    t.connection('userConnectionAdditionalArgs', {
      type: 'User',
      disableBackwardPagination: true,
      additionalArgs: {
        isEven: schema.booleanArg({
          description: 'If true, filters the users with an odd pk',
        }),
      },
      resolve() {
        // ...
      },
    })
  },
})
```

##### Example of extending connection type globally {docsify-ignore}

```ts
settings.change({
  schema: {
    connections: {
      extendConnection: {
        totalCount: {
          type: 'Int',
        },
      },
    },
  },
})

schema.queryType({
  definition(t) {
    t.connection('users', {
      type: 'User',
      nodes() {
        // ...
      },
      totalCount() {
        return ctx.users.totalCount(args)
      },
    })
  },
})
```

##### Example of extending connection type for one field {docsify-ignore}

```ts
schema.queryType({
  definition(t) {
    t.connection('users', {
      extendConnection(t) {
        t.int('totalCount', {
          resolve(source, args, ctx) {
            return ctx.users.totalCount(args),
          }
        })
      },
    })
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

### Type Glossary

#### `O` `Args`

todo

#### `U` `GraphQLType`

todo

#### `I` `TypeBuilder`

todo

#### `I` `Context`

todo

#### `I` `ResolverInfo`

todo

#### `I` `Node`

todo
