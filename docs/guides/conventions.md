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
