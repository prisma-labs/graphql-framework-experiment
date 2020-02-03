[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Flogger) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Fbug+))

Logging is one of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. A classic workhorse of debugging and development time feedback. There are a wealth of specialized tools but a great logging strategy can take you far. `nexus` gives you a logging system built for a modern cloud native environment.

It is recommended that your app only sends to stdout via the `nexus` logging system. This ensures that you maintain log level control and are always working with JSON. We work hard to make the logger so good that you'll to use it.

- Applications can get a reference to a logger singleton at `log`.

  ```ts
  import { log } from 'nexus-future'

  log.info('hello')
  ```

- Logs are formatted as JSON and then sent to `stdout`.
- There are six log levels: `fatal` `error` `warn` `info` `debug` `trace`. The default level in development is `debug` while in production it is `info`.

## Event Oriented

- The log api is designed to get you thinking about logs in terms of events with structured data instead of strings of interpolated data.
- This approach gets you significantly more leverage out of your logs once they hit your logging platform, e.g. [ELK](https://www.elastic.co/what-is/elk-stack)
- The first parameter of the log function is the event name and hence maps to the `event` field in the output JSON.
  ```ts
  log.info('hello')
  // { "event": "hello", ... }
  ```

## Context

- The second parameter is optional contextual information. The object passed here is nested under the `context` field in the output JSON.
  ```ts
  log.info('hello', { user: 'Toto' })
  // { "context": { "user": "Toto"  }, ... }
  ```
- If you have some information that you wish all logs to include in their context you can do this:
  ```ts
  log.addToContext({ user: 'Toto' })
  log.info('hello')
  log.warn('bye')
  // { "context": { "user": "Toto"  }, "event": "hello", ... }
  // { "context": { "user": "Toto"  }, "event": "bye", ... }
  ```
- Data is [merged deeply](https://lodash.com/docs/4.17.15#merge). When scalars conflict the most local takes precedence
  ```ts
  log.addToContext({ user: { name: 'Toto', age: 10 })
  log.info("hi", { user: { name: 'Titi', heightCM: 155 })
  // { "context": { "user": { "name": "Titi", age: 10, heightCM: 155 }}, ... }
  ```
- [child loggers](#child-loggers) inherit context from their parent and can add their own context but cannot modify their parents'

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

## Pretty Mode

- You can render logs in a human friendly way by turning pretty mode on.
- There are APIs and environment variables for that but you shouldn't have to use them in most cases.
- In development mode pretty mode is enabled by default
- Also if a tty is present pretty mode will be enabled by default
- Pretty mode looks something like this:

  ```
  ● info  nexus:dev:boot
  ● info  app:boot

  ------------
  LOGGING DEMO
  ------------
  ✕ fatal app:foo  --  lib: /see/
  ■ error app:foo  --  har: [object Object]
  ▲ warn  app:foo  --  bleep: 1,2,true
  ● info  app:foo
  ○ debug app:foo  --  foo: bar
  — trace app:foo  --  a: 1  b: 2  c: three
  ------------

  ● info  app:server:listening  --  host: localhost  port: 4000
  ```

## Child Loggers

You can create child loggers recursively starting from the root log. A child logger extends their parent's component path and inherits their parent's context. Children can add context that is visible to themselves and their descedents.

Child loggers are useful when you want to pass a logger to something that should be tracked as its own subsystem and/or may add context that you want isolated from the rest of the system. For example a classic use-case is the logger-instance-per-request pattern where a request-scoped logger is used for all logs in a request-response code path. This makes it much easier in production to group logs in your logging platform by request-response lifecycles.

All runtime logs in your app (including from plugins ([bug #300](https://github.com/graphql-nexus/nexus-future/issues/300))) come from either the `logger` itself or descendents thereof. This means if you wish absolutely every log being emitted by your app to contain some additional context you can do so simply by adding context to the root logger:

```ts
log.addToContext({ user: 'Toto' })
log
  .child('a')
  .child('b')
  .child('c')
  .info('hello')
// { "path": ["app", "a", "b", "c"],  context: { "user": "Toto" }, ... }
```

## debug Tool Integration

You may be a user of [`debug`](https://github.com/visionmedia/debug) or install libraries into your app that are. We (_will ↣_ [#265](https://github.com/graphql-nexus/nexus-future/issues/265)) have special case support for `debug` so that it seamlessly integrates into the `nexus` logging system. The gist is that all `debug` logs are routed through the `nexus` logger at `trace` level.
