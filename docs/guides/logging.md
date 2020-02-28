Logging is one of the primary means for knowing what is going on at runtime, what data is flowing through, and how so. A classic workhorse of debugging and development time feedback. There are a wealth of specialized tools but a great logging strategy can take you far. Nexus gives you a logging system built for a modern cloud native environment.

It is recommended that your app only sends to stdout via the Nexus logging system. This ensures that you maintain log level control and are always working with JSON. We work hard to make the logger so good that you'll to use it.

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

## debug Tool Integration

You may be a user of [`debug`](https://github.com/visionmedia/debug) or install libraries into your app that are. We (_will ↣_ [#265](https://github.com/graphql-nexus/nexus-future/issues/265)) have special case support for `debug` so that it seamlessly integrates into the Nexus logging system. The gist is that all `debug` logs are routed through the Nexus logger at `trace` level.
