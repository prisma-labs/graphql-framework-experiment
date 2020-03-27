# `import { log }`

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Flogger) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Fbug+)

Use the logger output structured information about runtime activity.

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

<p class="OneLineSignature"></p>

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

<p class="OneLineSignature"></p>

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

### Type Glossary

#### `I` `JSONLog`

**Type**

```ts
{
  level: 10 | 20 | 30 | 40 | 50
  time: number
  pid: number
  hostname: string
  path: string[]
  context: JSON
  event: string
}
```

- `level`  
  Numeric representation of log levels. Numeric because it easy later to filter e.g. level `30` and up. `10` is `trace` while on the other end of the scale `50` is `fatal`.

- `time`  
  Unix timestamp in milliseconds.

- `pid`  
  The process ID given by the host kernal.

- `hostname`  
  The machine host (`require('os').hostname()`)

- `path`  
  The fully qualified name of the logger.

  **Example**

  ```ts
  import { log } from 'nexus-future'

  log.info('hi') //              { path: ['nexus'], ... }
  log.child('b').info('hallo') // { path: ['nexus', 'b'], ... }
  ```

- `context`  
  Custom contextual data added by you. Any data added by the log call, previous `addToContext` calls, or inheritance from parent context.

- `event`  
  The name of this log event.

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
