# `import { server }`

[issues](https://github.com/graphql-nexus/nexus/labels/scope%2Fserver) - [`feature`](https://github.com/graphql-nexus/nexus/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+)

Use the server to run the HTTP server that clients will connect to.

### `express`

Gives you access to the underlying `express` instance.

Use this to add middlewares or expose additional REST endpoints if needed.

##### Example of using middlewares

```ts
import cors from 'cors'
import { server } from 'nexus'

server.express.use(cors())
```
