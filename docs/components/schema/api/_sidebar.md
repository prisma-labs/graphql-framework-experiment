- Getting Started

- [Introduction](README)
- [Onboarding](getting-started/onboarding)
- [Tutorial](getting-started/tutorial)
- [Migrate from Nexus Schema](getting-started/migrate-from-nexus-schema)
- [Changelog](changelog)

- Guides

- [Concepts](guides/concepts)
- [Schema](guides/schema)
- [Testing](guides/testing)
- [Project Layout](guides/project-layout)
- [Error Handling](guides/error-handling)
- [Plugins](guides/plugins)
- [Debugging](guides/debugging)
- [Recipes](references/recipes)
- [Writing Plugins](guides/writing-plugins)
- [CLI](guides/cli)

- Plugins

- [`prisma`](plugins/prisma)
- [`jwt-auth`](https://github.com/Camji55/nexus-plugin-jwt-auth)
- [`graphql-shield`](https://github.com/lvauvillier/nexus-plugin-shield)

* API

* [`nexus`](api/modules/main)

  - [`schema`](api/modules/main/exports/schema)
  - [`log`](api/modules/main/exports/logger)
  - [`server`](api/modules/main/exports/server)
  - [`settings`](api/modules/main/exports/settings)
  - [`use`](api/modules/main/exports/use)

- [`nexus/testing`](api/modules/testing)

- [`nexus/plugin`](api/modules/plugin)

- Meta

- [Roadmap ⤤](https://github.com/orgs/graphql-nexus/projects/1)
- [Changelog](changelog)
- [Architecture](architecture)

* Components Standalone

* [`@nexus/schema`](components/schema/about)

  - [API](components/schema/api/index.md)
    - [objectType](components/schema/api/copy/api-objectType)
    - [unionType](components/schema/api/copy/api-unionType)
    - [scalarType](components/schema/api/copy/api-scalarType)
    - [interfaceType](components/schema/api/copy/api-interfaceType)
    - [inputObjectType](components/schema/api/copy/api-inputObjectType)
    - [enumType](components/schema/api/copy/api-enumType)
    - [args: arg / \*Arg](components/schema/api/copy/api-args)
    - [makeSchema](components/schema/api/copy/api-makeSchema)
    - [extendType](components/schema/api/copy/api-extendType)
    - [mutationField](components/schema/api/copy/api-mutationField)
    - [queryField](components/schema/api/copy/api-queryField)
    - [Plugins](components/schema/api/copy/api-plugins)
  - [SDL Converter ⤤](https://nexus.js.org/converter)
  - [Plugins](components/schema/plugins)
    - [Connection](components/schema/plugins/connection)
    - [Query Complexity](components/schema/plugins/query-complexity)
    - [Field Authorize](components/schema/plugins/field-authorize)
    - [Nullability Guard](components/schema/plugins/nullability-guard)
    - [Prisma](components/schema/plugins/prisma)

- [`@nexus/logger`](components/logger/about)
  - [API](components/logger/api)
  - [Plugins](components/logger/plugins)
  - [Plugins API](components/logger/plugins-api)
