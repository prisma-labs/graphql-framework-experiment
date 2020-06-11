# `import { settings }`

[issues](https://github.com/graphql-nexus/nexus/labels/scope%2Fsettings) - [`feature`](https://github.com/graphql-nexus/nexus/issues?q=is%3Aopen+label%3Ascope%2Fsettings+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fsettings+label%3Atype%2Fbug+)

Use the settings to centrally configure various aspects of the various components.

### `change`

<!-- prettier-ignore -->
```ts
(settingsInput: {
  server?: {
    port?: number
    host?: string
    path?: string
    playground?: boolean | { path?: string }
  }
  authorization?: false | { formatError?: (authConfig: AuthorizationConfig) => Error }
  schema?: {
    nullable?: {
      outputs?: boolean
      inputs?: boolean
    }
    connections?: Record<string, ConnectionConfig>
    generateGraphQLSDLFile?: false | string
    rootTypingsGlobPattern?: string
  }
  logger?: {
    filter?: 
      | string
      | {
          level?: Level
          pattern?: string
        }
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

Change your app's current settings. This is an additive API meaning it can be called multiple times, each time merging with the previous settings.

#### `server.playground`

<div class="OneLineSignature"></div>

```
boolean
```

Should the app expose a [GraphQL Playground](https://github.com/prisma-labs/graphql-playground) to clients?

_Default_

`true` in dev, `false` otherwise.

#### `server.port`

<div class="OneLineSignature"></div>

```
number
```

The port the server should listen on.

_Default_

- Is `NEXUS_PORT` environment variable set? Then that.
- Is `PORT` environment variable set? Then that.
- Is `NODE_ENV` environment variable `production`? Then `80`
- Else `4000`

#### `server.host`

<div class="OneLineSignature"></div>

```
string
```

The host the server should listen on.

_Default_

- Is `HOST` environment variable set? Then that.
- Else the [Node HTTP server listen default](https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback) which is `'::'` if IPv6 is present otherwise `'0.0.0.0'` for IPv4.

#### `server.path`

<div class="OneLineSignature"></div>

```
string
```

The path on which the GraphQL API should be served.

_Default_

`/graphql`

#### `schema.nullable.inputs`

<div class="OneLineSignature"></div>

```
boolean
```

Should passing arguments be optional for clients by default?

_Default_

`true`

#### `schema.nullable.outputs`

<div class="OneLineSignature"></div>

```
boolean
```

Should the data requested by clients _not_ be guaranteed to be returned by default?

_Default_

`true`

#### `schema.generateGraphQLSDLFile`

<div class="OneLineSignature"></div>

```
false | string
```

Should a [GraphQL SDL file](https://www.prisma.io/blog/graphql-sdl-schema-definition-language-6755bcb9ce51) be generated when the app is built and to where?

A relative path is interpreted as being relative to the project directory. Intermediary folders are created automatically if they do not exist already.

_Default_

`api.graphql`

#### schema.authorization

<div class="OneLineSignature"></div>

```
false | { formatError?: (authConfig: AuthConfig) => Error }
```

Disable or configure the `authorize` field behaviour.


#### `schema.rootTypingsGlobPattern`

<div class="OneLineSignature"></div>

```
string
```

A glob pattern which will be used to find the files from which to extract the backing types used in the `rootTyping` option of `schema.(objectType|interfaceType|unionType|enumType)`

_Default_

The default glob pattern used id `./**/*.ts`

#### `schema.connections`

<div class="OneLineSignature"></div>

```ts
Record<string, ConnectionConfig>
```

todo

###### Example of adding a specialized kind of connection field builder {docsify-ignore}

```ts
import { settings } from 'nexus'

settings.change({
  schema: {
    connections: {
      analyticsConnection: {
        typePrefix: 'Analytics',
        extendConnection: {
          totalCount: { type: 'Int' },
          avgDuration: { type: 'Int' },
        },
      },
    },
  },
})
```

###### Example of including a `nodes` field like GitHub API globally {docsify-ignore}

If you want to include a `nodes` field, which includes the nodes of the connection flattened into an array similar to how GitHub does in their [GraphQL API](https://developer.github.com/v4/), set schema setting `includeNodesField` to `true`.

```ts
import { settings } from 'nexus'

settings.change({
  schema: {
    connections: {
      default: {
        includeNodesField: true,
      },
    },
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

#### `logger.filter`

<div class="OneLineSignature"></div>

```
string | { level?: Level, pattern?: string }
```

`string` form is shorthand for `logger.filter.pattern`. See below for object form.

#### `logger.filter.level`

Set the default filter level. This setting is used whenever a filter pattern does not specify the level. For example filter patterns like `*` `app` and `app:*` would use this setting but filter patterns like `*@*` `app@info+` `app:router@trace` would not.

When a log falls below the set level then it is not sent to the logger output (typically stdout).

_Default_

First found in the following order

1. `LOG_LEVEL` env var
2. `'info'` if `NODE_ENV=production`
3. `'debug'`

#### `logger.filter.pattern`

<div class="OneLineSignature"></div>

```
string
```

Filter logs by path and/or level.

_Default_

`'app:*, nexus:*@info+, *@warn+'`

##### Examples

```
    All logs at...

    Path
    app         app path at default level
    app:router  app:router path at default level

    List
    app,nexus   app and nexus paths at default level

    Path Wildcard
    *           any path at default level
    app:*       app path plus descendants at default level
    app::*      app path descendants at default level

    Negation
    !app      any path at any level _except_ those at app path at default level
    !*        no path (meaning, nothing will be logged)

    Removal
    *,!app      any path at default level _except_ logs at app path at default level
    *,!*@2-     any path _except_ those at debug level or lower
    app,!app@4  app path at default level _except_ those at warn level

    Levels
    *@info      all paths at info level
    *@error-    all paths at error level or lower
    *@debug+    all paths at debug level or higher
    *@3         all paths at info level
    *@4-        all paths at error level or lower
    *@2+        all paths at debug level or higher
    app:*@2-    app path plus descendants at debug level or lower
    app::*@2+   app path descendants at debug level or higher

    Level Wildcard
    app@*       app path at all levels
    *@*         all paths at all levels

    Explicit Root
    .           root path at default level
    .@info      root path at info level
    .:app       Same as "app"
    .:*         Same as "*"
```

#### `logger.pretty`

Shorthand for `logger.pretty.enabled`.

#### `logger.pretty.enabled`

Should logs be logged with rich formatting etc. (`true`), or as JSON (`false`)?

_Default_

- Is `LOG_PRETTY` environment variable `true`? Then `true`.
- Is `LOG_PRETTY` environment variable `false`? Then `false`.
- Is process.stdout attached to a TTY? Then `true`

###### Example of what it looks like

```
LOG_DEMO=true nexus dev
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

#### `logger.pretty.color`

Should logs have color?

_Default_

`true`

#### `logger.pretty.timeDiff`

Should a time delta between each log be shown in the gutter?

_Default_

`true`

#### `logger.pretty.levelLabel`

Should the label of the level be shown in the gutter?

_Default_

`false`

##### Example

```ts
import { settings } from 'nexus'

settings.change({
  server: {
    port: 9876,
  },
})
```

### `current`

##### Type

```ts
SettingsData
```

A reference to the current settings object.

### `original`

```ts
SettingsData
```

A reference to the original settings object.

### Type Glossary

#### Level

```
'trace' | 'debug' | 'info' | 'warn' | 'critical' | 'fatal'
```

#### SettingsData

todo
