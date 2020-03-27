# `import { settings }`

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fsettings) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fsettings+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fsettings+label%3Atype%2Fbug+)

Use the settings to centrally configure various aspects of the various components.

### `change`

**Signature**

<!-- prettier-ignore -->
```ts
(settingsInput: {
  server?: {
    port?: number
    host?: string
    path?: string
  }
  playground?: boolean
  schema?: {
    connections?: {} // TODO
    generateGraphQLSDLFile?: false | string
    rootTypingsGlobPattern?: string
  }
  logger?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'critical' | 'fatal'
    pretty?:
      | boolean
      | {
          enabled: boolean
          timeDiff: boolean
          color: boolean
          levelLabel: boolean
        }
  }
}) => Settings
```

- param `settingsInput`

  - `server.playground`  
    Should the app expose a [GraphQL Playground](https://github.com/prisma-labs/graphql-playground) to clients?

    **Default**

    `true` in dev, `false` otherwise.

  * `server.port`  
    The port the server should listen on.

    **Default**

    - Is `NEXUS_PORT` environment variable set? Then that.
    - Is `PORT` environment variable set? Then that.
    - Is `NODE_ENV` environment variable `production`? Then `80`
    - Else `4000`

* `server.host`  
  The host the server should listen on.

  **Default**

  - Is `NEXUS_HOST` environment variable set? Then that.
  - Is `HOST` environment variable set? Then that.
  - Else `0.0.0.0`

* `server.path`  
  The path on which the GraphQL API should be served.

  **Default**

  `/graphql`

* `schema.generateGraphQLSDLFile`
  Should a [GraphQL SDL file](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51) be generated when the app is built and to where?

  A relative path is interpreted as being relative to the project directory. Intermediary folders are created automatically if they do not exist already.

  **Default**

  `false`

* `schema.rootTypingsGlobPattern`

  A glob pattern which will be used to find the files from which to extract the backing types used in the `rootTyping` option of `schema.(objectType|interfaceType|unionType|enumType)`

  **Default**

  The default glob pattern used id `./**/*.ts`

* `schema.connections`

  todo

  ##### Example of adding a specialized kind of connection field builder {docsify-ignore}

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

  ##### Example of including a `nodes` field like GitHub API globally {docsify-ignore}

  If you want to include a `nodes` field, which includes the nodes of the connection flattened into an array similar to how GitHub does in their [GraphQL API](https://developer.github.com/v4/), set schema setting `includeNodesField` to `true`.

  ```ts
  import { settings } from 'nexus-future'

  settings.change({
    connections: {
      includeNodesField: true,
    },
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

- `logger.level`  
  The level which logs must be at or above to be logged. Logs below this level are discarded.

  **Default**

  `debug` in dev, `info` otherwise.

- `logger.pretty`  
  Shorthand for `logger.pretty.enabled`.

* `logger.pretty.enabled`  
  Should logs be logged with rich formatting etc. (`true`), or as JSON (`false`)?

  **Default**

  - Is `LOG_PRETTY` environment variable `true`? Then `true`.
  - Is `LOG_PRETTY` environment variable `false`? Then `false`.
  - Is process.stdout attached to a TTY? Then `true`

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

* `logger.pretty.color`  
  Should logs have color?

  **Default**

  `true`

* `logger.pretty.timeDiff`  
  Should a time delta between each log be shown in the gutter?

  **Default**

  `true`

- `logger.pretty.levelLabel`  
  Should the label of the level be shown in the gutter?

  **Default**

  `false`

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

**Type**

```ts
SettingsData
```

### `original`

A reference to the original settings object.

**Type**

```ts
SettingsData
```
