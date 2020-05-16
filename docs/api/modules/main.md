The main module exports an application singleton. It is available as the default export. For convenience you can import the app components as named exports too.

**Example of importing default export**

```ts
import app from 'nexus'

app.log.info('hello world')

app.settings.change({
  server: {
    port: 5689,
  },
})

app.schema.queryType({
  definition(t) {
    t.field('foo', { type: 'String' })
  },
})
```

**Example of imporrting named exports**

```ts
import { schema, settings, log } from 'nexus'

log.info('hello world')

settings.change({
  server: {
    port: 5689,
  },
})

schema.queryType({
  definition(t) {
    t.field('foo', { type: 'String' })
  },
})
```
