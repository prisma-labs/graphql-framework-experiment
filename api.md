<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

# Nexus API Reference

- [`/`](#)
  - [Exported Terms](#exported-terms)
    - [`log`](#log)
    - [`schema`](#schema)
    - [`server`](#server)
    - [`settings`](#settings)
  - [Exported Types](#exported-types)
- [`/testing`](#testing)
  - [Exported Terms](#exported-terms-1)
    - [`createTestContext`](#createtestcontext)
  - [Exported Types](#exported-types-1)
    - [`I` `TestContext`](#i-testcontext)
- [`/plugin`](#plugin)
  - [Exported Terms](#exported-terms-2)
    - [`create`](#create)
  - [Exported Types](#exported-types-2)
    - [`T` `Lens`](#t-lens)
- [Type Index](#type-index)
  - [`T` `App`](#t-app)
  - [`T` `Logger`](#t-logger)
  - [`F` `Log`](#f-log)
  - [`I` `ServerWithCustomizer`](#i-serverwithcustomizer)
  - [`F` `Customizer`](#f-customizer)
  - [`|` `MaybePromise`](#-maybepromise)
  - [`I` `Server`](#i-server)
  - [`I` `CustomizerLens`](#i-customizerlens)
  - [`T` `Settings`](#t-settings)
  - [`T` `SettingsInput`](#t-settingsinput)
  - [`T` `SettingsInput`](#t-settingsinput-1)
  - [`T` `SettingsInput`](#t-settingsinput-2)
  - [`T` `ExtraSettingsInput`](#t-extrasettingsinput)
  - [`T` `Schema`](#t-schema)
  - [`F` `ContextContributor`](#f-contextcontributor)
  - [`I` `TestContext`](#i-testcontext-1)
  - [`I` `nexusFutureTestContextRoot`](#i-nexusfuturetestcontextroot)
  - [`I` `nexusFutureTestContextApp`](#i-nexusfuturetestcontextapp)
  - [`T` `Variables`](#t-variables)
  - [`F` `DriverCreator`](#f-drivercreator)
  - [`T` `Driver`](#t-driver)
  - [`T` `WorkflowHooks`](#t-workflowhooks)
  - [`T` `OnAfterBaseSetupLens`](#t-onafterbasesetuplens)
  - [`F` `SideEffector`](#f-sideeffector)
  - [`F` `FileWatcherEventCallback`](#f-filewatchereventcallback)
  - [`T` `DbMigratePlanContext`](#t-dbmigrateplancontext)
  - [`T` `DbMigrateApplyContext`](#t-dbmigrateapplycontext)
  - [`T` `DbUiContext`](#t-dbuicontext)
  - [`&` `Layout`](#-layout)
  - [`T` `ScanResult`](#t-scanresult)
  - [`|` `PackageManagerType`](#-packagemanagertype)
  - [`&` `Data`](#-data)
  - [`T` `PackageManager`](#t-packagemanager)
  - [`T` `RuntimeContributions`](#t-runtimecontributions)
  - [`&` `DeepPartial`](#-deeppartial)
  - [`I` `TestContextAppCore`](#i-testcontextappcore)
  - [`F` `Definer`](#f-definer)
  - [`T` `Lens`](#t-lens-1)
  - [`F` `CallbackRegistrer`](#f-callbackregistrer)
  - [`T` `SuccessfulRunResult`](#t-successfulrunresult)
  - [`&` `RunOptions`](#-runoptions)
  - [`F` `PromptsConstructor`](#f-promptsconstructor)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### `/`

Exports the singleton app components. Use to build up your GraphQL schema and server.

#### Exported Terms

##### `log`

Of type [`Logger`](#t-logger)

##### `schema`

```ts
Schema & { addToContext: <Req extends any = Request, T extends {} = any>(contextContributor: ContextContributor<Req, T>) => void; }
```

##### `server`

Of type [`ServerWithCustomizer`](#i-serverwithcustomizer)

##### `settings`

Of type [`Settings`](#t-settings)

#### Exported Types

### `/testing`

#### Exported Terms

##### `createTestContext`

<!-- prettier-ignore -->
```ts
() => Promise<nexusFutureTestContextRoot>
```

#### Exported Types

##### `I` `TestContext`

```ts
typeIndexRef
```

### `/plugin`

#### Exported Terms

##### `create`

<!-- prettier-ignore -->
```ts
(definer: Definer) => DriverCreator
```

#### Exported Types

##### `T` `Lens`

```ts
typeIndexRef
```

### Type Index

#### `T` `App`

```ts
export type App = {
  log: Logger.Logger
  server: Server.ServerWithCustomizer
  settings: Settings

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
  connections?: {
    /**
     * todo
     */
    default?: ConnectionConfig | false
    // Extra undefined below is forced by it being above, forced via `?:`.
    // This is a TS limitation, cannot express void vs missing semantics,
    // being tracked here: https://github.com/microsoft/TypeScript/issues/13195
    [typeName: string]: ConnectionConfig | undefined | false
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

#### `I` `TestContext`

```ts
export type TestContext = nexusFutureTestContextRoot
```

#### `I` `nexusFutureTestContextRoot`

```ts
interface nexusFutureTestContextRoot {
  app: nexusFutureTestContextApp
}
```

#### `I` `nexusFutureTestContextApp`

```ts
interface nexusFutureTestContextApp extends TestContextAppCore {}
```

#### `T` `Variables`

```ts
export type Variables = { [key: string]: any }
```

#### `F` `DriverCreator`

<!-- prettier-ignore -->
```ts
export type DriverCreator = (pluginName: string) => Driver
```

#### `T` `Driver`

```ts
export type Driver = {
  name: string
  extendsWorkflow: boolean
  extendsRuntime: boolean
  extendsTesting: boolean
  loadWorkflowPlugin: (layout: Layout.Layout) => WorkflowHooks
  loadRuntimePlugin: () => undefined | RuntimeContributions
  loadTestingPlugin: () => undefined | TestingContributions
}
```

#### `T` `WorkflowHooks`

```ts
export type WorkflowHooks = {
  create: {
    onAfterBaseSetup?: (lens: OnAfterBaseSetupLens) => MaybePromise
  }
  dev: {
    onStart?: SideEffector
    onFileWatcherEvent?: Chokidar.FileWatcherEventCallback
    addToWatcherSettings: {
      /**
       * Set additional files to be watched for the app and plugin listeners
       */
      watchFilePatterns?: string[]
      listeners?: {
        /**
         * Define the watcher settings for the app listener
         */
        app?: {
          /**
           * Set files patterns that should not trigger a server restart by the app
           */
          ignoreFilePatterns?: string[]
        }
        /**
         * Define the watcher settings for your plugin listener
         */
        plugin?: {
          /**
           * Set file patterns that should trigger `dev.onFileWatcherEvent`
           * When set without `plugin.ignoreFilePatterns`, `dev.onFileWatcherEvent` will only react to changes made to the files which matches the `plugin.allowFilePatterns` patterns
           * When set with `plugin.ignoreFilePatterns`, `dev.onFileWatcherEvent` will only react to changes made to the files which matches the `plugin.allowFilePatterns` patterns, minus the files which matches `plugin.ignoreFilePatterns`
           */
          allowFilePatterns?: string[]
          /**
           * Set file patterns that should not trigger `dev.onFileWatcherEvent`
           * When set without `plugin.allowFilePatterns`, `dev.onFileWatcherEvent` will react to changes made to all files watched except the files which matches the `plugin.ignoreFilePatterns` patterns
           * When set with `plugin.allowFilePatterns`, , `dev.onFileWatcherEvent` will react to changes made to all files matched by `plugin.allowFilesPatterns` except the files which matches the `plugin.ignoreFilePatterns` patterns
           */
          ignoreFilePatterns?: string[]
        }
      }
    }
  }
  generate: {
    onStart?: SideEffector
  }
  build: {
    onStart?: SideEffector
  }
  db?: {
    init: {
      onStart: SideEffector
    }
    migrate: {
      plan: {
        onStart: (ctx: DbMigratePlanContext) => void
      }
      apply: {
        onStart: (ctx: DbMigrateApplyContext) => void
      }
      rollback: {
        onStart: SideEffector
      }
    }
    ui: {
      onStart: (ctx: DbUiContext) => void
    }
  }
}
```

#### `T` `OnAfterBaseSetupLens`

```ts
export type OnAfterBaseSetupLens = {
  database: 'SQLite' | 'MySQL' | 'PostgreSQL' | undefined
  connectionURI: string | undefined
}
```

#### `F` `SideEffector`

<!-- prettier-ignore -->
```ts
export type SideEffector = () => MaybePromise
```

#### `F` `FileWatcherEventCallback`

<!-- prettier-ignore -->
```ts
export type FileWatcherEventCallback = (
  eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
  path: string,
  stats: fs.Stats | undefined,
  runner: {
    restart: (file: string) => void /* stop: () => void, start: () => void */
  } //TODO: add stop and start methods
) => void
```

#### `T` `DbMigratePlanContext`

```ts
export type DbMigratePlanContext = {
  migrationName: string | undefined
}
```

#### `T` `DbMigrateApplyContext`

```ts
export type DbMigrateApplyContext = {
  force: boolean | undefined
}
```

#### `T` `DbUiContext`

```ts
export type DbUiContext = {
  port?: number
}
```

#### `&` `Layout`

```ts
/**
 * Layout represents the important edges of the project to support things like
 * scaffolding, build, and dev against the correct paths.
 */
export type Layout = Data & {
  /**
   * Property that aliases all the and only the data properties, makes it
   * easy to e.g. serialize just the data.
   */
  data: Data
  projectRelative(filePath: string): string
  sourceRelative(filePath: string): string
  sourcePath(subPath: string): string
  packageManager: PackageManager.PackageManager
}
```

#### `T` `ScanResult`

```ts
/**
 * The part of layout data resulting from the dynamic file/folder inspection.
 */
export type ScanResult = {
  // build: {
  //   dir: string
  // }
  // source: {
  //   isNested: string
  // }
  app:
    | {
        exists: true
        path: string
      }
    | {
        exists: false
        path: null
      }
  project: {
    name: string
    isAnonymous: boolean
  }
  sourceRoot: string
  sourceRootRelative: string
  projectRoot: string
  schemaModules: string[]
  packageManagerType: PackageManager.PackageManager['type']
  // schema:
  //   | {
  //       exists: boolean
  //       multiple: true
  //       paths: string[]
  //     }
  //   | {
  //       exists: boolean
  //       multiple: false
  //       path: null | string
  //     }
  // context: {
  //   exists: boolean
  //   path: null | string
  // }
}
```

#### `|` `PackageManagerType`

```ts
export type PackageManagerType = 'yarn' | 'npm'
```

#### `&` `Data`

```ts
/**
 * The combination of manual datums the user can specify about the layout plus
 * the dynamic scan results.
 */
export type Data = ScanResult & {
  buildOutput: string
}
```

#### `T` `PackageManager`

```ts
//
// Fluent API
//

/**
 * The package manager as a fluent API, all statics partially applied with the
 * package manager type.
 */
export type PackageManager = {
  type: PackageManagerType
  installDeps: OmitFirstArg<typeof installDeps>
  addDeps: OmitFirstArg<typeof addDeps>
  runBin: OmitFirstArg<typeof runBin>
  runScript: OmitFirstArg<typeof runScript>
  renderRunBin: OmitFirstArg<typeof renderRunBin>
  renderRunScript: OmitFirstArg<typeof renderRunScript>
  renderAddDeps: OmitFirstArg<typeof renderAddDeps>
}
```

#### `T` `RuntimeContributions`

```ts
/**
 * The possible things that plugins can contribute toward at runtime. Everything
 * is optional.
 */
export type RuntimeContributions<C extends {} = any> = {
  context?: {
    typeGen: {
      fields: Record<string, string>
      imports?: Array<{
        as: string
        from: string
      }>
    }
    create: (req: Express.Request) => C
  }
  // todo schema property name
  nexus?: {
    typegenAutoConfig?: NexusSchema.core.SchemaConfig['typegenAutoConfig']
    plugins?: NexusSchema.core.SchemaConfig['plugins']
  }
}
```

#### `&` `DeepPartial`

```ts
export type DeepPartial<T extends Record<string, any>> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
} & { [x: string]: any }
```

#### `I` `TestContextAppCore`

```ts
export interface TestContextAppCore {
  query: AppClient['query']
  server: {
    start: () => Promise<void>
    stop: () => Promise<void>
  }
}
```

#### `F` `Definer`

<!-- prettier-ignore -->
```ts
type Definer = (lens: Lens) => void
```

#### `T` `Lens`

```ts
export type Lens = {
  runtime: CallbackRegistrer<RuntimePlugin>
  workflow: CallbackRegistrer<WorkflowDefiner>
  testing: CallbackRegistrer<TestingPlugin>
  utils: {
    log: Logger.Logger
    runSync: typeof runSync
    run: typeof run
    /**
     * Check out https://github.com/terkelg/prompts for documentation
     */
    prompt: PromptsConstructor
  }
}
```

#### `F` `CallbackRegistrer`

<!-- prettier-ignore -->
```ts
export type CallbackRegistrer<F> = (f: F) => void
```

#### `T` `SuccessfulRunResult`

```ts
export type SuccessfulRunResult = {
  command: string
  stderr: null | string // present if stdio using pipe mode
  stdout: null | string // present if stdio using pipe mode
  signal: null | string
  exitCode: null | number // present if optional (non-throw) mode
  error: null | Error // present if optonal (non-throw) mode
}
```

#### `&` `RunOptions`

```ts
// TODO should not use sync options type for async run
export type RunOptions = Omit<SpawnSyncOptions, 'encoding'> & {
  envAdditions?: Record<string, string | undefined>
  require?: boolean
}
```

#### `F` `PromptsConstructor`

<!-- prettier-ignore -->
```ts
type PromptsConstructor = <T extends string = string>(
  questions: Prompts.PromptObject<T> | Array<Prompts.PromptObject<T>>,
  options?: Prompts.Options
) => Promise<Prompts.Answers<T>>
```
