### Exported Terms

#### `log`

Of type [`Logger`](#t-logger)

#### `schema`

```ts
Schema & { addToContext: <Req extends any = Request, T extends {} = any>(contextContributor: ContextContributor<Req, T>) => void; }
```

#### `server`

Of type [`ServerWithCustomizer`](#i-serverwithcustomizer)

#### `settings`

Of type [`Settings`](#t-settings)

### Exported Types

### Type Index

#### `T` `App`

```ts
export type App = {
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=logger)  ⌁  [Guide](https://nexus-future.now.sh/#/guides/logging)
   *
   * ### todo
   */
  log: Logger.Logger
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
   *
   * ### todo
   *
   */
  server: Server.ServerWithCustomizer
  /**
   * todo
   */
  settings: Settings
  /**
   * [API Reference](https://nexus-future.now.sh/#/references/api?id=appschema) // [Guide](todo)
   *
   * ### todo
   */
  schema: Schema.Schema & {
    // addToContext is a bridge between two components, schema and server, so
    // its not in schema currently...

    /**
     * todo
     */
    addToContext: <Req extends any = Request, T extends {} = any>(
      contextContributor: ContextContributor<Req, T>
    ) => void
  }
}
```

#### `T` `Logger`

```ts
export type Logger = {
  fatal: Log
  error: Log
  warn: Log
  info: Log
  debug: Log
  trace: Log
  addToContext: (context: Context) => Logger // fluent
  child: (name: string) => Logger // fluent
}
```

#### `F` `Log`

<!-- prettier-ignore -->
```ts
type Log = (event: string, context?: Context) => void
```

#### `I` `ServerWithCustomizer`

```ts
export interface ServerWithCustomizer extends Server {
  /**
   * Provides a way to use a custom GraphQL server such as Apollo Server or Fastify
   */
  custom: (customizer: Customizer) => void
}
```

#### `F` `Customizer`

<!-- prettier-ignore -->
```ts
export type Customizer = (
  lens: CustomizerLens
) => Utils.MaybePromise<Server | void>
```

#### `|` `MaybePromise`

```ts
export type MaybePromise<T = void> = T | Promise<T>
```

#### `I` `Server`

```ts
/**
 * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
 *
 * ### todo
 *
 */
export interface Server {
  /**
   * Start the server instance
   */
  start(): Promise<void>
  /**
   * Stop the server instance
   */
  stop(): Promise<void>
}
```

#### `I` `CustomizerLens`

```ts
interface CustomizerLens {
  /**
   * The generated executable GraphQL Schema
   */
  schema: GraphQL.GraphQLSchema
  /**
   * The original Express server bundled with Nexus. Use it to add express middlewares or change its configuration in any way
   */
  express: Express
  /**
   * Function to add the generated context by Nexus to your custom server.
   * /!\ **If you need to add additional properties to your context, please use `schema.addToContext`**
   */
  context: ContextCreator
}
```

#### `T` `Settings`

```ts
/**
 * todo
 */
export type Settings = {
  /**
   * todo
   */
  original: SettingsData
  /**
   * todo
   */
  current: SettingsData
  /**
   * todo
   */
  change(newSetting: SettingsInput): void
}
```

#### `T` `SettingsInput`

```ts
type SettingsInput = {
  logger?: Logger.SettingsInput
  schema?: Schema.SettingsInput
  server?: Server.ExtraSettingsInput
}
```

#### `T` `SettingsInput`

```ts
export type SettingsInput = {
  /**
   * Set the level of this and all descedent loggers. This level setting has
   * highest precedence of all logger level configuration tiers.
   *
   * The level config takes the first value found, searching tiers as follows:
   *
   *  1. logger instance setting
   *  2. logger constructor setting
   *  3. LOG_LEVEL environment variable setting
   *  3. NODE_ENV=production -> info
   *  4. otherwise -> debug
   */
  level?: Level.Level
  /**
   * Control pretty mode.
   *
   * Shorthands:
   *
   *  - `true` is shorthand for `{ enabled: true }`
   *  - `false` is shorthand for `{ enabled: false }`
   *
   * When `undefined` pretty takes the first value found, in order:
   *
   *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
   *  2. `process.stdout.isTTY`
   */
  pretty?:
    | boolean
    | {
        /**
         * Disable or enable pretty mode.
         *
         * When `undefined` pretty takes the first value found, in order:
         *
         *  1. `process.env.LOG_PRETTY` (admits case insensitive: `true` | `false`)
         *  2. `process.stdout.isTTY`
         */
        enabled?: boolean
        /**
         * Should logs be colored?
         *
         * @default `true`
         *
         * Disabling can be useful when pretty logs are going to a destination that
         * does not support rendering ANSI color codes (consequence being very
         * difficult to read content).
         */
        color?: boolean
        /**
         * Should logs include the level label?
         *
         * @default `false`
         *
         * Enable this if understanding the level of a log is important to you
         * and the icon+color system is insufficient for you to do so. Can be
         * helpful for newcomers or a matter of taste for some.
         */
        levelLabel?: boolean
        /**
         * Should the logs include the time between it and previous log?
         *
         * @default `true`
         */
        timeDiff?: boolean
      }
}
```

#### `T` `SettingsInput`

```ts
export type SettingsInput = {
  /**
   * todo
   */
  connections?: ConnectionConfig & {
    // We tried the idea of types.default: false | ConnectionConfig
    // but got blocked by https://github.com/microsoft/TypeScript/issues/17867

    /**
     * todo
     *
     * @default `false`
     */
    disableDefaultType?: boolean
    /**
     * todo
     */
    types?: {
      default?: ConnectionConfig
      // Extra undefined below is forced by it being above, forced via `?:`.
      // This is a TS limitation, cannot express void vs missing semantics,
      // being tracked here: https://github.com/microsoft/TypeScript/issues/13195
      [typeName: string]: ConnectionConfig | undefined
    }
  }
}
```

#### `T` `ExtraSettingsInput`

```ts
export type ExtraSettingsInput = {
  /**
   * todo
   */
  port?: number
  /**
   * todo
   */
  playground?: boolean
  /**
   * Create a message suitable for printing to the terminal about the server
   * having been booted.
   */
  startMessage?: (address: { port: number; host: string; ip: string }) => void
}
```

#### `T` `Schema`

```ts
export type Schema = {
  // addToContext: <T extends {}>(
  //   contextContributor: ContextContributor<T>
  // ) => App
  queryType: typeof NexusSchema.queryType
  mutationType: typeof NexusSchema.mutationType
  objectType: typeof NexusSchema.objectType
  inputObjectType: typeof NexusSchema.inputObjectType
  enumType: typeof NexusSchema.enumType
  scalarType: typeof NexusSchema.scalarType
  unionType: typeof NexusSchema.unionType
  interfaceType: typeof NexusSchema.interfaceType
  arg: typeof NexusSchema.arg
  intArg: typeof NexusSchema.intArg
  stringArg: typeof NexusSchema.stringArg
  booleanArg: typeof NexusSchema.booleanArg
  floatArg: typeof NexusSchema.floatArg
  idArg: typeof NexusSchema.idArg
  extendType: typeof NexusSchema.extendType
  extendInputType: typeof NexusSchema.extendInputType
}
```

#### `F` `ContextContributor`

<!-- prettier-ignore -->
```ts
// todo the jsdoc below is lost on the destructured object exports later on...
// todo plugins could augment the request
// plugins will be able to use typegen to signal this fact
// all places in the framework where the req object is referenced should be
// actually referencing the typegen version, so that it reflects the req +
// plugin augmentations type
type ContextContributor<Req, T extends {} = any> = (req: Req) => T
```
