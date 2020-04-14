Nexus imposes a few requirements about how you structure your codebase.

## Schema Module(s)

##### Pattern

A `graphql` module or directory of modules `graphql.ts` `graphql/*.ts`.

This may be repeated multiple times in your source tree.

##### About

This convention is optional if entrypoint is present, required otherwise.

This is where you should write your GraphQL type definitions.

In dev mode the modules are synchronously found and imported when the server starts. Conversely, at build time, codegen runs making the modules statically imported. This is done to support tree-shaking and decrease application start time.

## Entrypoint

##### Pattern

A module, anywhere in your source directory, named `app.ts`.

##### About

This convention is optional if schema modules are present, required otherwise.

## Project Layout

Nexus considers the folder containing a `tsconfig.json` to be the project root.

Nexus honours settings within `tsconfig.json`.

Nexus requires that the value of `compilerOptions.rootDir` to be within the `includes` array. Together, these define the source root. All of your app code must live within the source root.

If you do not specify `compilerOptions.rootDir` then source root is taken to be project root.

You can control the build output with `compilerOptions.outDir`. You can override its value with `nexus build --out`. By default build output goes into `node_modules/.build`.
