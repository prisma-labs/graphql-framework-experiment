[`issues`](https://github.com/graphql-nexus/nexus-future/labels/scope%2Fplugins) ([`feature`](https://github.com/graphql-nexus/nexus-future/issues?q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Ffeature), [`bug`](https://github.com/graphql-nexus/nexus-future/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Fbug+))

## Here Be Dragons

- Writing plugins is an expressive and exciting part of the nexus-future framework
- But please note that it is one of the least stable components
- Not just in terms of lack of polish or unstable APIs but entire concepts and architecture
- The bar to a finished stable plugin system is high not just because plugin systems are in general challenging, but also because the thing which it permits extending is itself not stable either: the framework components exposed at the application layer
- If you are embarking on creating a plugin, please be aware you are in uncharted territory with no guarantees about API stability or even entire concepts/ways of extending nexus-future
- If you are ok with that, we welcome you aboard this journey and hope you share your feedback with the team on GitHub and creations with the community on slack!

## How it Looks

- `nexus-future` CLI has a command to create new nexus-future plugin projects
  ```cli
  npx nexus-future create plugin
  ```
- To write a plugin you import from the plugin module
  ```ts
  import * as nexus-futurePlugin from 'nexus-future/plugin'
  ```
- Use the `create` function to build your plugin

  ```ts
  import * as nexus-futurePlugin from 'nexus-future/plugin'

  nexus-futurePlugin.create(() => { ... })
  ```

- Export your plugin as default from your package entrypoint

  ```ts
  export default nexus-futurePlugin.create(() => { ... })
  ```

- Your callback will be passed an api to hook into nexus-future

  ```ts
  export default nexus-futurePlugin.create(project => { ... })
  ```

- You can hook into the runtime or the worktime ([todo](https://github.com/graphql-nexus/nexus-future/issues/294))

  ```ts
  export default nexus-futurePlugin.create(project => {
    project.worktime(() => { ... })
    project.runtime(() => { ... })
  })
  ```

- You have access to project utils ([todo](https://github.com/graphql-nexus/nexus-future/issues/282))

  ```ts
  export default nexus -
    futurePlugin.create(project => {
      project.utils.logger.trace('hello')
    })
  ```

- At runtime you can pass configuration to `nexus` and contribute toward the graphql resolver context:

  ```ts
  export default nexus-futurePlugin.create(project => {
    project.runtime(() => {
      return {
        context: {
          create: req => {
            returm {
              token: req.headers.authorization.match(/^Bearer (.+)$/)?[1] ?? null
              }
            },
            typeGen: {
              fields: {
                token: 'null | string'
              }
            }
          },
          nexus: {
            ...
          }
        }
      }
    })
  })
  ```

- At worktime you can hook onto various events grouped by subsystem:

  ```ts
  export default nexus-futurePlugin.create(project => {
    project.worktime(hooks => {
      // Not all hooks shown here
      hooks.build.onStart = async () => { ... }
      hooks.create.onAfterBaseSetup = async () => { ... }
      hooks.generate.onStart = async () => { ... }
      hooks.dev.onStart = async () => { ... }
      hooks.dev.onFileWatcherEvent = async () => { ... }
      hooks.dev.addToSettings = { ... }
      hooks.db.init.onStart = async () => { ... }
      hooks.db.migrate.apply = async () => { ... }
      hooks.db.plan.onStart = async () => { ... }
      hooks.db.rollback.onStart = async () => { ... }
      hooks.db.ui.onStart = async () => { ... }
    })
  })
  ```

- Some worktime hooks give you contextual information to reflect upon:

  ```ts
  export default nexus -
    futurePlugin.create(project => {
      project.worktime(hooks => {
        hooks.db.plan.onStart = async hctx => {
          project.logger.info(hctx.migrationName)
        }
      })
    })
  ```

## Wholistic

- The breadth of nexus-future's plugin system is uncommon
- Most tools are either rutime (Express) or workflow (ESLint) oriented and thus naturally scope their plugins to their focus
- the advantage of nexus-future's approach where plugins can hook into both workflow and runtime is that they allow plugin authors to deliver rich wholistic experiences for their users
- For example a plugin author might reinforce their plugin's runtime feature with additions to doctor which lint for idiomatic usage
- No longer does a plugin need rely on a lengthy readme that probably isn't complete and probably isn't read by most users to guide users through correct configuration, etc. usage of their plugin
- `nexus-future` is fanatic about giving as much latitude as possible to plugin authors to craft plugins that forward the principal of the pit of success to nexus-future app developers

## Runtime vs Worktime

- runtime is for hooking into when your app is actually running
- so logic here can directly impact your production systems's reliability and performance characteristics
- worktime is for hooking into things like dev testing and building
- logic here is relatively free from concern over runtime impact, e.g. some slow running build-time extensions cannot impact latency experienced by end-users of the app in production.

## Publishing for Consumption

- You must name your plugin package `nexus-plugin-<your-plugin-name>`
- `nexus-future` plugin cli will rely on this convention to search install etc. plugins ([todo](https://github.com/graphql-nexus/nexus-future/issues/155))
- `nexus-future` relies on this pattern to auto-use plugins in a user's project

## A Code Reference

- The most sophisticated real-world nexus-future plugin is prisma.
- It currently drives many of the requirements of the plugin system where we want nexus-future-prisma users to feel prisma is as seamless a component as any core one.
- If you like learning by reading code, check it out here: [graphql-nexus/plugin-prisma](https://github.com/graphql-nexus/plugin-prisma).
