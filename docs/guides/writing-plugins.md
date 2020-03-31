[issues](https://github.com/graphql-nexus/nexus/labels/scope%2Fplugins) – [features](https://github.com/graphql-nexus/nexus/issues?q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Ffeat) ⬝ [bugs](https://github.com/graphql-nexus/nexus/issues?utf8=%E2%9C%93&q=is%3Aopen+label%3Ascope%2Fplugins+label%3Atype%2Fbug+)

## Here Be Dragons

- Writing plugins is an expressive and exciting part of Nexus
- But please note that it is one of the least stable components
- Not just in terms of lack of polish or unstable APIs but entire concepts and architecture
- The bar to a finished stable plugin system is high not just because plugin systems are in general challenging, but also because the thing which it permits extending is itself not stable either: the framework components exposed at the application layer
- If you are embarking on creating a plugin, please be aware you are in uncharted territory with no guarantees about API stability or even entire concepts/ways of extending Nexus
- If you are ok with that, we welcome you aboard this journey and hope you share your feedback with the team on GitHub and creations with the community on slack!

## How it Looks

- Nexus CLI has a command to create new Nexus-plugin projects
  ```cli
  npx nexus@0.20.0-next.1 create plugin
  ```
- To write a plugin you create any of `testtime` `runtime` and `worktime` modules and import the respective plugin types to type your function. In each module export your plugin as `plugin`.

  ```ts
  // runtime.ts
  import { RuntimePlugin } from 'nexus/plugin'

  export const plugin: RuntimePlugin = project => {
    /* ... */
  }
  ```

  ```ts
  // testtime.ts
  import { TesttimePlugin } from 'nexus/plugin'

  export const plugin: TesttimePlugin = project => {
    /* ... */
  }
  ```

  ```ts
  // worktime.ts
  import { WorktimePlugin } from 'nexus/plugin'

  export const plugin: WorktimePlugin = project => {
    /* ... */
  }
  ```

- The `project` parameter gives you access to utils and core components

  ```ts
  export const plugin: TesttimePlugin = project => {
    project.utils.log.trace('hello')
  }
  ```

- With runtime plugins you can pass configuration to Nexus and contribute toward the graphql resolver context:

  ```ts
  export const plugin: RuntimePlugin = (project => {
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
          // ...
        }
      }
    }
  }
  ```

- With worktime plugins you can hook onto various events grouped by subsystem:

  ```ts
  export const plugin:WorktimePlugin = project => {
    // Not all hooks shown here
    project.hooks.build.onStart = async () => { ... }
    project.hooks.create.onAfterBaseSetup = async () => { ... }
    project.hooks.generate.onStart = async () => { ... }
    project.hooks.dev.onStart = async () => { ... }
    project.hooks.dev.onFileWatcherEvent = async () => { ... }
    project.hooks.dev.addToSettings = { ... }
    project.hooks.db.init.onStart = async () => { ... }
    project.hooks.db.migrate.apply = async () => { ... }
    project.hooks.db.plan.onStart = async () => { ... }
    project.hooks.db.rollback.onStart = async () => { ... }
    project.hooks.db.ui.onStart = async () => { ... }
  }
  ```

- Some worktime hooks give you contextual information to reflect upon:

  ```ts
  export default nexusPlugin.create(project => {
    project.worktime(hooks => {
      hooks.db.plan.onStart = async hctx => {
        project.log.info(hctx.migrationName)
      }
    })
  })
  ```

## Wholistic

- The breadth of Nexus' plugin system is uncommon
- Most tools are either rutime (Express) or workflow (ESLint) oriented and thus naturally scope their plugins to their focus
- the advantage of Nexus' approach where plugins can hook into both workflow and runtime is that they allow plugin authors to deliver rich wholistic experiences for their users
- For example a plugin author might reinforce their plugin's runtime feature with additions to doctor which lint for idiomatic usage
- No longer does a plugin need rely on a lengthy readme that probably isn't complete and probably isn't read by most users to guide users through correct configuration, etc. usage of their plugin
- Nexus is fanatic about giving as much latitude as possible to plugin authors to craft plugins that forward the principal of the pit of success to Nexus app developers

## Runtime vs Worktime

- runtime is for hooking into when your app is actually running
- so logic here can directly impact your production systems's reliability and performance characteristics
- worktime is for hooking into things like dev testing and building
- logic here is relatively free from concern over runtime impact, e.g. some slow running build-time extensions cannot impact latency experienced by end-users of the app in production.

## Publishing for Consumption

- You must name your plugin package `nexus-plugin-<your-plugin-name>`
- Nexus plugin cli will rely on this convention to search install etc. plugins ([todo](https://github.com/graphql-nexus/nexus/issues/155))
- Nexus relies on this pattern to auto-use plugins in a user's project

## A Code Reference

- The most sophisticated real-world Nexus plugin is `nexus-plugin-prisma`.
- It currently drives many of the requirements of the plugin system where we want nexus-prisma users to feel prisma is as seamless a component as any core one.
- If you like learning by reading code, check it out here: [graphql-nexus/plugin-prisma](https://github.com/graphql-nexus/plugin-prisma).
