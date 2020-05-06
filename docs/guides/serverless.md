- Nexus has experimental support for serverless deployments.
- Support for serverless is being tracked in [#782](https://github.com/graphql-nexus/nexus/issues/782).
- Serverless features are not yet documented in the API docs.
- The server component of Nexus exposes HTTP request handlers.

  ```ts
  import { server } from 'nexus'

  server.handlers.graphql // call with (req, res)
  server.handlers.playground // call with (req, res)
  ```

- Use these to handle to requests in your serverless environment.

  ```ts
  import { server } from 'nexus'

  export default (req, res) => {
    server.handlers.graphql(req, res)
  }
  ```

- See the [Next.JS example](https://github.com/graphql-nexus/examples/tree/master/integration-nextjs) for a functioning serverless reference.
