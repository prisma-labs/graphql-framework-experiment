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

Nexus honours settings within `tsconfig.json`. This ensures that Nexus and your IDE perform matching static analysis.

_project root_

Project Root is the CWD (current working directory) for all CLI invocatons.

Nexus considers the folder containing a `tsconfig.json` to be the project root.

_source root_

Source Root is the base from which your source code layout starts. So, all of your app code must live within the source root. Your JavaScript build output will mirror it.

Source Root is defined by setting `compilerOptions.rootDir` and adding its value also to the `includes` array. For detail into why it works like this see [microsoft/TypeScript#9858](https://github.com/microsoft/TypeScript/issues/9858#issuecomment-533287263) and this [StackOverflow answer](https://stackoverflow.com/questions/57333825/can-you-pull-in-excludes-includes-options-in-typescript-compiler-api).

If you do not specify `compilerOptions.rootDir` then source root is taken to be project root, and the `includes` array may be empty.

Nexus requires that the `includes` array does not contain any modules source the source root.

_out root_

You can control the build output with `compilerOptions.outDir`. You can override its value with `nexus build --out`. By default build output goes into `node_modules/.build`.
