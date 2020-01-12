## Logging

Logging is an important part of most any app. It helps developers debug their apps and is often a primary means for knowing what is going on at runtime, what data is flowing through, and how so. While there are all sorts of specialized tools that can replace vanilla logging for their respective use-cases, that shouldn't discount the value of having great logs and maximizing their benefit.

`santa` gives you a logging system built for a modern cloud native environment. Here are some of the things it does for you:

- Outputs newline-delimited JSON ([NDJSON](http://ndjson.org/))  
  **_why_** A natural format for most any logging platform.

- Uses a beautiful pretty mode during development  
  **_why_** JSON is appropiate for machines but less so for humans.

- Exposes the pretty renderer as a CLI (forthcoming feature)  
  **_why_** Allows you to pipe JSON logs from a remote location thus maintaining the human-readable experience you get in development.

- Event oriented API, JSON schema, and pretty mode  
  **_why_** Thinking of logs as events and keeping contextual information as structured data rather than interpolated into strings empowers your downstream to do more. For example better filtering in development mode and better aggregations in production in your logging platform.

- Request logger instances  
  **_why_** These enable you to attach contextual information such as user IDs or trace IDs that subsequent logs in the request lifecycle will maintain. In turn this helps you reason about your logs in your logging platform later: group by user id, isolate all activity of a single request, and so on.

- Standardizes six log levels: `fatal` `error` `warn` `info` `debug` `trace`  
  **_why_** Give logs more meaning/semantics, helps enable alerting policies, enables keeping production logs lean whilst maintaining higher resolution for development in development.

- Integrates logs from [`debug`](https://github.com/visionmedia/debug) into `trace` level logs (forthcoming feature)  
  **_why_** We make it possible to continue benefiting from the widespread use of this tool in the node community in our structured system.
