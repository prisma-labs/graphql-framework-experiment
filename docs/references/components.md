## Logger

[`issues`](https://github.com/prisma-labs/graphql-santa/labels/scope%2Flogger) ([`feature`](https://github.com/prisma-labs/graphql-santa/issues?q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Ffeature), [`bug`](https://github.com/prisma-labs/graphql-santa/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Flogger+label%3Atype%2Fbug+))

### About

Logging is an important part of most any app. It helps developers debug their apps and is often a primary means for knowing what is going on at runtime, what data is flowing through, and how so. While there are all sorts of specialized tools that can replace vanilla logging for their respective use-cases, that shouldn't discount the value of having great logs and maximizing their benefit.

`santa` gives you a logging system built for a modern cloud native environment.

### Features

- Uses a beautiful pretty mode during development  
  **_why_** JSON is appropiate for machines but less so for humans.

  **_example_**

  ```
  ● info  santa:dev:boot
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

- Outputs newline-delimited JSON ([NDJSON](http://ndjson.org/)) <br>
  **_why_** A natural format for most any cloud-native logging platform.

  **_example_**

  ```
  {"level":30,"time":1578887817230,"pid":30997,"hostname":"Jasons-Prisma-Machine.local","path":["santa","dev"],"context":{},"event":"boot","v":1}
  {"level":30,"time":1578887819619,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{},"event":"boot","v":1}
  {"level":60,"time":1578887819621,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"lib":{}},"event":"foo","v":1}
  {"level":50,"time":1578887819621,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"har":{"mar":"tek"}},"event":"foo","v":1}
  {"level":40,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"bleep":[1,"2",true]},"event":"foo","v":1}
  {"level":30,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{},"event":"foo","v":1}
  {"level":20,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"foo":"bar"},"event":"foo","v":1}
  {"level":10,"time":1578887819622,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app"],"context":{"a":1,"b":2,"c":"three"},"event":"foo","v":1}
  {"level":30,"time":1578887819645,"pid":30998,"hostname":"Jasons-Prisma-Machine.local","path":["app","server"],"context":{"host":"localhost","port":4000},"event":"listening","v":1}
  ```

* (_will ↣_ [#263](https://github.com/prisma-labs/graphql-santa/issues/263)) Exposes the pretty renderer as a CLI  
  **_why_** Allows you to pipe JSON logs from a remote location thus maintaining the human-readable experience you get in development.

* Event oriented API, JSON schema, and pretty mode  
  **_why_** Thinking of logs as events and keeping contextual information as structured data rather than interpolated into strings empowers your downstream to do more. For example better filtering in development mode and better aggregations in production in your logging platform.

* Request logger instances  
  **_why_** These enable you to attach contextual information such as user IDs or trace IDs that subsequent logs in the request lifecycle will maintain. In turn this helps you reason about your logs in your logging platform later: group by user id, isolate all activity of a single request, and so on.

* Standardizes six log levels: `fatal` `error` `warn` `info` `debug` `trace`  
  **_why_** Give logs more meaning/semantics, helps enable alerting policies, enables keeping production logs lean whilst maintaining higher resolution for development in development.

* (_will ↣_ [#265](https://github.com/prisma-labs/graphql-santa/issues/265)) Integrates logs from [`debug`](https://github.com/visionmedia/debug)  
  **_why_** We make it possible to continue benefiting from the widespread use of this tool in the node community in our structured system.

* (_will ↣_ [#264](https://github.com/prisma-labs/graphql-santa/issues/264)) Interactive filtering on the command line  
  **_why_** Keep yourself in the flow by focusing on the logs most relevant to your current development loop; Enjoy `trace` level without an overwhelming firehose; Enjoy isolating your or someone else's plugin logs.
