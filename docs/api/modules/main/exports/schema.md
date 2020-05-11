# `import { schema }`

[issues](https://github.com/graphql-nexus/nexus/labels/scope%2Fschema) - [`features`](https://github.com/graphql-nexus/nexus/issues?q=is%3Aopen+label%3Ascope%2Fschema+label%3Atype%2Ffeat) [`bugs`](https://github.com/graphql-nexus/nexus/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fschema+label%3Atype%2Fbug+)

Use the schema to model your domain, all the data that your API will accept and return, and how all the various objects in the domain relate to one another (the "graph" in "GraphQL").

### `objectType`

[GraphQL Docs for Object Types](https://graphql.org/learn/schema/#object-types-and-fields)

The most common kind of type in most GraphQL schemas. of a GraphQL schema are object types, a type you can
fetch from your schema, with fields:

##### Signature

```ts
objectType(config: {
  name:             string
  description?:     string
  rootTyping?:      NexusGenBackingTypes
  nonNullDefaults?: NonNullConfig
  definition:       ObjectDefinitionBlock
}) => NexusObjectType
```

- `name` **(required)** The name of this object.

- `definition` **(required)** The function used to define the fields of this object. See below for the various field builders available.

- `description` The description of this object. Tools like GraphQL Playground can display this content.

- `nonNullDefaults` <code class="TypeRef">[NonNullConfig](#i-nonnullconfig)</code>

- `rootTyping` <code class="TypeRef">[NexusGenBackingTypes](#s-nexusgenbackingtypes)</code>

##### Example

```ts
import { schema } from 'nexus'

schema.objectType({
  name: 'User',
  definition(t) {
    t.int('id', { description: 'Id of the user' })
    t.string('fullName', { description: 'Full name of the user' })
    t.list.field('posts', {
      type: 'Post',
      resolve(post, args, ctx) {
        return ctx.db.user.getOne(post.id).posts()
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
```

#### `t.field`

##### Signature

```ts
(
  name: string,
  config: FieldConfig
) => void
```

todo

#### `t.<scalar>`

```
t.id
t.string
t.boolean
t.int
t.float
```

Field builder specialization for GraphQL scalar types: `string`, `boolean`, `int`, `float`, `id`. They are like `t.field` but omit the `config.type` property and accept a resolver as their second parameter as an alternative to full-on field config.

##### Signature

```ts
(name: string, param?: UntypedFieldConfig | Resolver) => void
```

#### `t.list`

Use this to express a list of some other type. All field builders are available as properties.

#### `t.implements`

todo

##### Signature

```ts
(...interfaceNames: string[]) => void
```

#### `t.modify`

Modify a field added via an interface.

##### Signature

```ts
(fieldName: string, modifications: todo) => void
```

todo

#### `t.connection`

This field builder helps you implement paginated associations between types in your schema. The contributions that it makes to your GraphQL schema adhear to the [Relay Connection Specification](https://facebook.github.io/relay/graphql/connections.htm#sec-Node). In other words it allows you the API author to write the minimum logic required to create spec-compliant relay connections for your API clients.

##### Signature

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

  - `type` <code class="TypeRef" >[GraphQLType](#graphqltype)</code>  
    The type of this field.

  - `resolve` <code class="TypeRef" >[Resolver](#graphqltype)</code>  
    Implement everything yourself.

    Useful for more complex pagination cases, where you may want to use utilities from other libraries like [`graphql-relay`](https://github.com/graphql/graphql-relay-js), and only use Nexus for the construction and type-safety.

    Unlike with `nodes` approach, this approach makes no assumptions about values for the `edges` `cursor` `pageInfo` properties.

    ##### Optionality

    Forbidden if `nodes` given. Required otherwise.

  - `nodes` <code class="TypeRef" >[NodeResolver](#graphqltype)</code>

    ##### Optionality

    Forbidden if `resolve` given. Required otherwise.

    ##### Remarks

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

  * `additionalArgs` <code class="TypeRef" >[Args](#args)</code>  
    Additional arguments to use for just this field.

    ##### Default

    `undefined`

    ##### Remarks

    When used, the `additionalArgs` in app settings `schema.connections` will not be inherited. If you do wish to inherit them, enable that with `inheritAdditionalArgs`.

  * `inheritAdditionalArgs`  
    Whether to inherit the `additionalArgs` from app settings `schema.connections`

    ##### Default

    `true` if `additionalArgs` is not set, `false` otherwise.

  * `disableForwardPagination`  
    If `true` then `first` and `after` args are _not_ present. When disabled, `last` arg becomes required, unless you disable `strictArgs`.

    ##### Default

    `false`

  - `disableBackwardPagination`  
    If `true` then `last` and `before` args are _not_ present. When disabled, `first` arg becomes required, unless you disable `strictArgs`.

    ##### Default

    `false`

  - `strictArgs`  
    Whether `first`/`last` arg nullability should reflect the forward/backward pagination configuration. When `true`, then the following pattern is used:

    - when _only_ forward pagination enabled
      - meaning, `disableForwardPagination && !disableBackwardPagination`
      - then, `last` arg is required
    - when _only_ backward pagination enabled
      - meaning, `!disableForwardPagination && disableBackwardPagination`
      - then, `first` arg is required

    ##### Default

    `true`

  - `validateArgs`  
    Custom logic to validate the args. Throw an error to signal validation failure.

    ##### Signature

    <p class="OneLineSignature"></p>

    ```ts
    (args: Args, info: ResolverInfo) => void
    ```

    ##### Default

    Validates that client passes a `first` or a `last` arg, and not both.

  - `extendConnection`
    Dynamically add additional fields to the GraphQL connection object. Similar to `extendEdge`.

    ##### Signature

    <p class="OneLineSignature"></p>

    ```ts
    (t: TypeBuilder) => void
    ```

    ##### Default

    `undefined`

    ##### Remarks

    Because this customizes the GraphQL connection object type, the _name_ of the type will necessarially be changed as well. If it didn't, it would conflict with the non-extended connection type in your schema (if any). The following pattern will be used to name the GraphQL object type:

    <p class="OneLineSignature"></p>

    ```
    {camelCaseJoin: <typeName><fieldName>}_Connection
    ```

    ##### Example

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

    ##### Signature

    <p class="OneLineSignature"></p>

    ```ts
    (t: TypeBuilder) => void
    ```

    ##### Default

    `undefined`

    ##### Remarks

    Because this customizes the GraphQL edge object type, the _name_ of the type will necessarially be changed as well. If it didn't, it would conflict with the non-extended edge type in your schema (if any). The following pattern will be used to name the GraphQL object type:

    <p class="OneLineSignature"></p>

    ```
    {camelCaseJoin: <typeName><fieldName>}_Edge
    ```

    ##### Example

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

    ##### Signature

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

    ##### Default

    `undefined`

  * `cursorFromNode`
    Approach we use to transform a node into a cursor

    ##### Signature

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

    ##### Default

    `'nodeField'`

##### SchemaContributions {docsify-ignore}

todo

##### Example of using `resolve` {docsify-ignore}

```ts
import { schema } from 'nexus'
import { connectionFromArray } from 'graphql-relay'

schema.queryType({
  definition(t) {
    t.connection('users', {
      type: 'User',
      async resolve(root, args, ctx, info) {
        return connectionFromArray(await ctx.resolveUserNodes(), args)
      },
    })
  },
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

### `queryType`

Refer to `objectType`. This is a shorthand where `config.name` is assigned `Query`.

### `mutationType`

Refer to `objectType`. This is a shorthand where `config.name` is assigned `Mutation`.

### `subscriptionType`

Not implemented, please see [#447](https://github.com/graphql-nexus/nexus/issues/447).

### `inputObjectType`

[GraphQL Docs for Input Object Types](https://graphql.org/learn/schema/#input-types)

Defines an object which can be passed as an input value.

##### Signature

<!-- prettier-ignore -->
```ts
(config: {
  description?:      string
  nonNullDefaults?:  NonNullConfig
  definition:        InputObjectDefinitionBlock
}) => NexusInputObjectType
```

- `name`  
  The name of this object.

- `description`  
  The description of this object. Tools like GraphQL Playground can display this content.

  ##### Default

  `undefined`

- `nonNullDefaults`  
  todo

  ##### Default

  `undefined`

- `definition`  
  See below for the various field builders available.

##### Example

<div class="Row">

```ts
import { schema } from 'nexus'

schema.inputObjectType({
  name: 'MyInput',
  definition(t) {
    t.string('foo', { required: true })
    t.int('bar')
  },
})

schema.objectType({
  name: 'Qux',
  definition(t) {
    t.string('toto', {
      args: {
        myInput: 'MyInput',
      },
    })
  },
})
```

```graphql
input MyInput {
  bar: Int
  foo: String!
}

type Qux {
  toto(myInput: MyInput): String
}
```

</div>

Unlike object types, input types do not have arguments, so they do not have resolvers or "backing types"

#### `t.field`

todo

#### `t.<scalar>`

todo

#### `t.list`

todo

### `enumType`

[GraphQL Docs for Enum Types](https://graphql.org/learn/schema/#enumeration-types)

##### Signature

```ts
enumType(config: NexusEnumTypeConfig): NexusEnumTypeDef
```

##### `NexusEnumTypeConfig` options

- `name` **(required)**: Name of your type

- `members` **(required)**: All members of the enum, either as an array of strings/definition objects, as an object, or as a TypeScript enum

- `description` _(optional)_: The description to annotate the GraphQL SDL

- `rootTyping` _(optional)_: Root type information for this type. By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting

##### Example

Defining as an array of enum values:

```ts
import { schema } from 'nexus'

const Episode = schema.enumType({
  name: 'Episode',
  members: ['NEWHOPE', 'EMPIRE', 'JEDI'],
  description: 'The first Star Wars episodes released',
})
```

As an object, with a simple mapping of enum values to internal values:

```ts
import { schema } from 'nexus'

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

##### Signature

```ts
interfaceType(config: NexusInterfaceTypeConfig): NexusInterfaceTypeDef
```

##### `NexusInterfaceTypeConfig` options

- `name` **(required)**: Name of your type

- `definition` **(required)**: A function to define the fields of your type

- `description` _(optional)_: The description to annotate the GraphQL SDL

- `nonNullDefaults` _(optional)_: Configures the nullability for the type, check the documentation's "Getting Started" section to learn more about GraphQL Nexus's assumptions and configuration
  on nullability.

- `rootTyping` _(optional)_: Root type information for this type. By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting

##### Example

```ts
import { schema } from 'nexus'

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

Nexus allows you to provide an `asNexusMethod` property which will make the scalar available as a builtin on the definition block object. We automatically generate and merge the types so you get type-safety just like the scalar types specified in the spec.

##### Signature

```ts
scalarType(config: NexusScalarTypeConfig): NexusScalarTypeDef
```

##### `NexusScalarTypeConfig` options

- `name` **(required)**: Name of your type

- `serialize` **(required)**: Serializes an internal value to include in a response

- `description` _(optional)_: The description to annotate the GraphQL SDL

- `deprecation` _(optional)_: Any deprecation info for this scalar type

- `parseValue` _(optional)_: Parses an externally provided value to use as an input

- `parseLiteral` _(optional)_: Parses an externally provided literal value to use as an input

- `asNexusMethod` _(optional)_: Adds this type as a method on the Object/Interface definition blocks

- `rootTyping` _(optional)_: Root type information for this type. By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting

##### Example

```ts
import { schema } from 'nexus'

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

### `unionType`

[GraphQL Docs for Union Types](https://graphql.org/learn/schema/#union-types)

Union types are very similar to interfaces, but they don't get to specify any
common fields between the types.

##### Signature

```ts
unionType(config: NexusUnionTypeConfig): NexusUnionTypeDef
```

##### `NexusUnionTypeConfig` options

- `name` **(required)**: Name of your type

- `description` _(optional)_: The description to annotate the GraphQL SDL

- `deprecation` _(optional)_: Info about a field deprecation. Formatted as a string and provided with the deprecated directive on field/enum types and as a comment on input field

- `rootTyping` _(optional)_: Root type information for this type. By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting

##### Example

```ts
import { schema } from 'nexus'

schema.unionType({
  name: 'MediaType',
  description: 'Any container type that can be rendered into the feed',
  definition(t) {
    t.members('Post', 'Image', 'Card')
    t.resolveType((item) => item.name)
  },
})
```

### `arg`

[GraphQL Docs on Arguments](https://graphql.org/learn/schema/#arguments)

##### Signature

<!-- prettier-ignore -->
```ts
(config: {
  type:         'Boolean' | 'Float' | 'Int' | 'String' | 'ID'
  defualt?:     TYPEGEN
  description?: string
  list?:        null | true | boolean[]
  nullable?:    boolean
  required?:    boolean
}) => NexusArgDef
```

- `type`  
  The type of the argument.

- `required`  
  Whether the argument is required or not.

  When `true` then `nullable` is `false`.

- `nullable`  
  Whether the argument is nullable or not.

  When `true` then `required` is `false`.

- `list`  
  Whether the argument is a list or not.

  When `true` it is a list.

  When an array, the inner boolean specifies whether the list member can be nullable.

- `description`  
  The description to annotate the GraphQL SDL

##### Example

Defines an argument that can be used in any object or interface type. Args can be reused in multiple locations, and it can be convenient to create your own wrappers around arguments.

```ts
import { schema } from 'nexus'
import { ScalarArgConfig } from 'nexus/types'

function requiredInt(opts: ScalarArgConfig<number>) {
  return schema.arg({ ...opts, required: true, type: 'Int' })
}
```

### `<scalar>Arg`

```
idArg
stringArg
booleanArg
intArg
floatArg
```

Sugar for creating arguments of type `Int` `String` `Float` `ID` `Boolean`.

### `addToContext`

Add context to your graphql resolver functions. The objects returned by your context contributor callbacks will be shallow-merged into `ctx`. The `ctx` type will also accurately reflect the types you return from callbacks passed to `addToContext`.

##### Example

```ts
import { schema } from 'nexus'

schema.addToContext((_req) => {
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

### `use`

Add schema plugins to your app. These plugins represent a subset of what framework plugins ([`app.use`](/api/modules/main/exports/use)) can do. This is useful when, for example, a schema plugin you would like to use has not integrated into any framework plugin. You can find a list of schema plugins [here](/components/schema/plugins).

##### Example

```ts
import { schema } from 'nexus'
import somePlugin from 'some-plugin'

schema.use(somePlugin())

schema.use({
  name: 'myPlugin',
  description: 'my inline schema plugin',
  // ...
})
```

### `middleware`

Run arbitrary logic before and/or after GraphQL resolvers in your schema. Middleware is run as a first-in-first-out (FIFO) stack. The order of your middleware definitions determines their order in the stack.

##### Signature

```ts
schema.middleware((config: CreateFieldResolverInfo) => MiddlewareFn | undefined)): void
```

`schema.middleware` expect a function with the signature `(root, args, ctx, info, next)` to be returned.

If the current middleware function does not end the request-response cycle, it must call `next` to pass control to the next middleware function, until the actual GraphQL resolver gets called.

> Note: You can skip the creation of a middleware by returning `undefined` instead of a middleware.

##### Example: Simple middlewares

```ts
// graphql.ts
import { schema } from 'nexus'

schema.middleware((_config) => {
  return async (root, args, ctx, info, next) => {
    ctx.log.info('before - middleware 1')
    const result = await next(root, args, ctx, info)
    ctx.log.info('after - middleware 1')
    return result
  }
})

schema.middleware((_config) => {
  return async (root, args, ctx, info, next) => {
    ctx.log.info('before - middleware 2')
    const result = await next(root, args, ctx, info)
    ctx.log.info('after - middleware 2')
    return result
  }
})

schema.queryType({
  definition(t) {
    t.string('hello', (_root, _args, ctx) => {
      ctx.log.info('executing resolver')
      return Promise.resolve('world')
    })
  },
})

/**
 * Output
 * before - middleware 1
 * before - middleware 2
 * executing resolver
 * after - middleware 2
 * after - middleware 1
 */
```

##### Example: Trace resolvers completion time of the `Query` type only

```ts
import { schema } from 'nexus'

schema.middleware((config) => {
  if (config.parentTypeConfig.name !== 'Query') {
    return
  }

  return async (root, args, ctx, info, next) => {
    const startTimeMs = new Date().valueOf()
    const value = await next(root, args, ctx, info)
    const endTimeMs = new Date().valueOf()
    const resolver = `Query.${config.fieldConfig.name}`
    const completionTime = endTimeMs - startTimeMs

    ctx.log.info(`Resolver '${resolver}' took ${completionTime} ms`, {
      resolver,
      completionTime,
    })

    return value
  }
})

schema.queryType({
  definition(t) {
    t.string('hello', async () => {
      // Wait two seconds
      await new Promise((res) => setTimeout(res, 2000))
      return 'world'
    })
  },
})

/**
 * Output:
 * ● server:request Resolver 'Query.hello' took 2001 ms  --  resolver: 'Query.hello'  time: 2001
 */
```

### `importType`

##### Signature

```ts
schema.importType(scalarType: GraphQLScalarType, methodName?: string): GraphQLScalarType
schema.importType(type: GraphQLNamedType): GraphQLNamedType
```

`schema.importType` is useful for adding existing GraphQL.js types into your Nexus schema.

[Check out this repository](https://github.com/Urigo/graphql-scalars) for a handful list of useful scalar types that might be useful to your GraphQL API.

When passing a `GraphQLScalarType`, you can additionally pass a `methodName` as a second parameter, which will augment the `t` parameter of your definition builder with a convenient method to create a field of the associated type.

##### Example: Adding a date scalar type

```ts
// graphql.ts
import { schema } from 'nexus'
import { GraphQLDate } from 'graphql-iso-date'
     
schema.importType(GraphQLDate, 'date')
     
schema.objectType({
  name: 'SomeObject',
  definition(t) {
    t.date('createdAt') // t.date() is now available (with types!) thanks to `importType`
  },
})
```

`schema.importType` can also be used to add types from an existing GraphQL schema into your Nexus schema. This is useful to incrementally adopt Nexus if you already have a schema-first GraphQL schema.

##### Example: Adding types from a schema-first schema

```ts
import { schema } from 'nexus'
import { existingSchema } from './existing-schema'


Object.values(
  existingSchema.getTypeMap()
).forEach(schema.importType)
```

### Type Glossary

#### `I` `FieldConfig`

```ts
{
  type:         string
  args?:        Args
  description?: string
  deprecation?: string
  nullable?:    boolean
  list?:        true | boolean[]
  resolve:      Resolver
}
```

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

#### `I` `NonNullConfig`

todo

```ts
{
  /**
   * Whether output fields are non-null by default.
   *
   * type Example {
   *   field: String!
   *   otherField: [String!]!
   * }
   *
   * @default true
   */
  output?: boolean;
  /**
   * Whether input fields (field arguments, input type members)
   * are non-null by default.
   *
   * input Example {
   *   field: String
   *   something: [String]
   * }
   *
   * @default false
   */
  input?: boolean;
}
```

#### `I` `RootTypingImport`

todo

```ts
{
  /**
   * File path to import the type from.
   */
  path: string;
  /**
   * Name of the type we want to reference in the `path`
   */
  name: string;
  /**
   * Name we want the imported type to be referenced as
   */
  alias?: string;
}
```

#### `F` `Resolver`

todo

#### `S` `NexusGenBackingTypes`

todo

By default, types are extracted for any .ts file in your project. You can configure that from the `schema.rootTypingsGlobPattern` setting
