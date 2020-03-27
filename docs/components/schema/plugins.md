## Connection

The connection plugin provides a new method on the object definition builder, enabling paginated associations between types, following the [Relay Connection Specification](https://facebook.github.io/relay/graphql/connections.htm#sec-Node). It provides simple ways to customize fields available on the `Connection`, `Edges`, or `PageInfo` types. {docsify-ignore}

To install, add the `connectionPlugin` to the `makeSchema.plugins` array, along with any other plugins
you'd like to include:

```ts
import { makeSchema, connectionPlugin } from 'nexus'

const schema = makeSchema({
  // ... types, etc,
  plugins: [
    // ... other plugins
    connectionPlugin(),
  ],
})
```

By default, the plugin will install a `t.connectionField` method available on the object definition builder:

```ts
export const User = objectType({
  name: "User",
  definition(t) {
    t.connectionField(...);
  },
});
```

You can change the name of this field by specifying the `nexusFieldName` in the plugin config.

#### Usage {docsify-ignore}

There are two main ways to use the connection field, with a `nodes` property, or a `resolve` property:

##### With `resolve` {docsify-ignore}

If you have custom logic you'd like to provide in resolving the connection, we allow you to instead specify a `resolve` field, which will make not assumptions about how the `edges`, `cursor`, or `pageInfo` are defined.

You can use this with helpers provided via [graphql-relay-js](https://github.com/graphql/graphql-relay-js).

```ts
import { connectionFromArray } from 'graphql-relay'

export const usersQueryField = queryField(t => {
  t.connectionField('users', {
    type: User,
    async resolve(root, args, ctx, info) {
      return connectionFromArray(await ctx.resolveUserNodes(), args)
    },
  })
})
```

##### With `nodes` {docsify-ignore}

When providing a `nodes` property, we make some assumptions about the structure of the connection. We only
require you return a list of rows to resolve based on the connection, and then we will automatically infer the `hasNextPage`, `hasPreviousPage`, and `cursor` values for you.

```ts
t.connectionField('users', {
  type: User,
  nodes(root, args, ctx, info) {
    // [{ id: 1,  ... }, ..., { id: 10, ... }]
    return ctx.users.resolveForConnection(root, args, ctx, info)
  },
})
```

One limitation of the `nodes` property, is that you cannot paginate backward without a `cursor`, or without defining a `cursorFromNode` property on either the field or plugin config. This is because we can't know how long the connection list may be to begin paginating backward.

```ts
t.connectionField('usersConnectionNodes', {
  type: User,
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
```

##### Including a `nodes` field: {docsify-ignore}

If you want to include a `nodes` field, which includes the nodes of the connection flattened into an array similar to how GitHub does in their [GraphQL API](https://developer.github.com/v4/), set `includeNodesField` to `true`

```ts
connectionPlugin({
  includeNodesField: true,
})
```

```graphql
query IncludeNodesFieldExample {
  users(first: 10) {
    nodes {
      id
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

##### Top level connection field {docsify-ignore}

The `queryField` or `mutationField` helpers may accept a function rather than a field name, which will be shorthand for the query builder:

```ts
export const usersField = queryField(t => {
  t.connectionField('users', {
    type: Users,
    nodes(root, args, ctx, info) {
      return ctx.users.forConnection(root, args)
    },
  })
})
```

There are properties on the plugin to help configure this including, `cursorFromNode`, which allows you to customize how the cursor is created, or `pageInfoFromNodes` to customize how `hasNextPage` or `hasPreviousPage` are set.

#### Pagination Arguments {docsify-ignore}

##### Modifying arguments {docsify-ignore}

You may specify `additionalArgs` on either the plugin or the field config, to add additional arguments to the connection:

```ts
t.connectionField('userConnectionAdditionalArgs', {
  type: User,
  disableBackwardPagination: true,
  additionalArgs: {
    isEven: booleanArg({
      description: 'If true, filters the users with an odd pk',
    }),
  },
  resolve() {
    // ...
  },
})
```

If you have specified args on the field, they will overwrite any custom args defined on the plugin config, unless `inheritAdditionalArgs` is set to true.

##### Disabling forward/backward pagination {docsify-ignore}

By default we assume that the cursor can paginate in both directions. This is not always something every
API needs or supports, so to turn them off, you can set `disableForwardPagination`, or `disableBackwardPagination` to
true on either the `paginationConfig`, or on the `fieldConfig`.

When we disable the forward or backward pagination args, by default we set the remaining `first` or `last` to required.
If you do not want this to happen, specify `strictArgs: false` in the plugin or field config.

##### Argument validation {docsify-ignore}

By default, the connection field validates that a `first` or a `last` must be provided, and not both. If you wish to provide your own validation, supply a `validateArgs` property to either the `connectionPlugin` config, or to the field configuration directly.

```ts
connectionPlugin({
  validateArgs(args, info) {
    // ... custom validate logic
  },
})

// or

t.connectionField('users', {
  // ...
  validateArgs: (args, info) => {
    // custom validate logic
  },
})
```

#### Extending Connection / Edge types {docsify-ignore}

There are two ways to extend the connection type, one is by providing `extendConnection` on the `connectionPlugin` configuration, the other is to add an `extendConnection` or `extendEdge` definition block on the field config.

##### Globally {docsify-ignore}

```ts
connectionPlugin({
  extendConnection: {
    totalCount: { type: 'Int' },
  },
})

t.connectionField('users', {
  type: User,
  nodes: () => {
    // ...
  },
  totalCount() {
    return ctx.users.totalCount(args)
  },
})
```

##### One-off / per-field {docsify-ignore}

```ts
t.connectionField('users', {
  extendConnection(t) {
    t.int('totalCount', {
      resolve: (source, args, ctx) => ctx.users.totalCount(args),
    })
  },
})
```

The field-level customization approach will result in a custom connection type specific to that type/field, e.g. `QueryUsers_Connection`, since the modification is specific to the individual field.

#### Multiple Connection Types {docsify-ignore}

You can create multiple field connection types with varying defaults, available under different connections builder methods. A `typePrefix` property should be supplied to configure the name

Custom Usage:

```ts
import { makeSchema, connectionPlugin } from 'nexus'

const schema = makeSchema({
  // ... types, etc,
  plugins: [
    connectionPlugin({
      typePrefix: 'Analytics',
      nexusFieldName: 'analyticsConnection',
      extendConnection: {
        totalCount: { type: 'Int' },
        avgDuration: { type: 'Int' },
      },
    }),
    connectionPlugin({}),
  ],
})
```

## Field Authorize

The authorize plugin allows us to define field-level authorization to a query.

```ts
t.field('postById', {
  type: Post,
  args: { id: idArg() },
  authorize: (root, args, ctx) => ctx.auth.canViewPost(args.id),
  resolve(root, args, ctx) {
    return ctx.post.byId(args.id)
  },
})
```

## Nullability Guard

This plugin helps us guard against non-null values crashing our queries in production. It does this by defining that every scalar value have a "fallback" value defined, so if we see a nullish value on an otherwise non-null field, we will fallback to this instead of crashing the query.

<div >

<div class="NextIs Warn"></div>

> The `nullabilityGuardPlugin` by default only guards when `process.env.NODE_ENV === 'production'`. This is intended so you see/catch these errors in development and do not use it except as a last resort. If you want to change this, set the `shouldGuard` config option.

#### Example {docsify-ignore}

```ts
import { nullabilityGuardPlugin } from 'nexus'

const guardPlugin = nullabilityGuardPlugin({
  onNullGuarded(ctx, info) {
    // This could report to a service like Sentry, or log internally - up to you!
    console.error(
      `Error: Saw a null value for non-null field ${info.parentType.name}.${
        info.fieldName
      } ${root ? `(${root.id || root._id})` : ''}`
    )
  },
  // A map of `typeNames` to the values we want to replace with if a "null" value
  // is seen in a position it shouldn't be. These can also be provided as a config property
  // for the `objectType` / `enumType` definition, as seen below.
  fallbackValues: {
    Int: () => 0,
    String: () => '',
    ID: ({ info }) => `${info.parentType.name}:N/A`,
    Boolean: () => false,
    Float: () => 0,
  },
})
```

### Null Guard Algorithm

- If a field is nullable:

  - If the field is non-list, do not guard
  - If the field is a list, and none of the list members are nullable, do not guard

- If the field is non-nullable and the value is null:

  - If the field is a list:
    - If the value is nullish, return an empty list `[]`
    - If the list is non-empty, iterate and complete with a valid non-null fallback
  - If the value is a Union/Interface

    - Return with an object with the `__typename` of the first type which implements this contract

  - If the field is an object:
    - If the value is nullish
      - If there is a fallback defined on the object for that type, return with that
      - Else return with an empty object
    - Return the value and push forward to the next resolvers

## Query Complexity

A single GraphQL query can potentially generate a huge workload for a server, like thousands of database operations which can be used to cause DDoS attacks. In order to limit and keep track of what each GraphQL operation can do, the query complexity plugin allows defining field-level complexity values that works with the [graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity) library.

To install, add the `queryComplexityPlugin` to the `makeSchema.plugins` array, along with any other plugins you'd like to include:

```ts
import { makeSchema, queryComplexityPlugin } from 'nexus'

const schema = makeSchema({
  // ... types, etc,
  plugins: [
    // ... other plugins
    queryComplexityPlugin(),
  ],
})
```

The plugin will install a `complexity` property on the output field config:

```ts
export const User = objectType({
  name: 'User',
  definition(t) {
    t.id('id', {
      complexity: 2,
    })
  },
})
```

And of course, integrate `graphql-query-complexity` with your GraphQL server. You can setup with `express-graphql` as in [the library's example](https://github.com/slicknode/graphql-query-complexity#usage-with-express-graphql).

#### Complexity Value {docsify-ignore}

There are two ways to define the complexity:

- A number
- A complexity estimator

The easiest way to specify the complexity is to just provide a number, as in the example code above. The `complexity` property can be omitted if its value is `1`, provided that you have a simple estimator of 1 when configuring `graphql-query-complexity` like below:

```ts
const complexity = getComplexity({
  // ... other configurations
  estimators: [
    // All undefined complexity values will fallback to 1
    simpleEstimator({ defaultComplexity: 1 }),
  ],
})
```

Another way is with the complexity estimator, which is a function that returns a number, but also provides arguments to compute the final value. The query complexity plugin augments `graphql-query-complexity`'s default complexity estimator by providing its corresponding nexus types to ensure type-safety. No additional arguments are introduced so the function declaration is still syntactically equal.

Augmented complexity estimator function signature:

```ts
type QueryComplexityEstimatorArgs<
  TypeName extends string,
  FieldName extends string
> = {
  // The root type the field belongs too
  type: RootValue<TypeName>

  // The GraphQLField that is being evaluated
  field: GraphQLField<
    RootValue<TypeName>,
    GetGen<'context'>,
    ArgsValue<TypeName, FieldName>
  >

  // The input arguments of the field
  args: ArgsValue<TypeName, FieldName>

  // The complexity of all child selections for that field
  childComplexity: number
}

type QueryComplexityEstimator = (
  options: QueryComplexityEstimatorArgs
) => number | void
```

And you can use it like so:

```ts
export const users = queryField('users', {
  type: 'User',
  list: true,
  args: {
    count: intArg({ nullable: false }),
  },
  // This will calculate the complexity based on the count and child complexity.
  // This is useful to prevent clients from querying mass amount of data.
  complexity: ({ args, childComplexity }) => args.count * childComplexity,
  resolve: () => [{ id: '1' }],
})
```

For more info about how query complexity is computed, please visit [graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity).

## Prisma

```cli
npm install nexus-prisma
```
