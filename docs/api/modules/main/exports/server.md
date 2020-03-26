# Server

[issues](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fserver) - [`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Ffeat) [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fserver+label%3Atype%2Fbug+)

Use this to run your HTTP server that clients will connect to. The default server is an instance of [`express-graphql`](https://github.com/graphql/express-graphql).

### `start`

Make the server start listening for incoming client connections.

Calling start while already started is a no-op.

Normally you should not need to use this method. When your app does not call `server.start`, Nexus will do so for you automatically.

### `stop`

Make the server stop listening for incoming client connections.

Calling stop while the server is already stopped is a no-op.

Normally you should not need to use this method.

### express

Gives you access to the underlying `express` instance.

Use this to add middlewares or expose additional REST endpoints if needed.

**Example of using middlewares**

```ts
import cors from 'cors'
import { server } from 'nexus-future'

server.express.use(cors())
```
