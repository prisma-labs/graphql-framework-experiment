## `graphql.ts` | `graphql/*`

Optional –– Your GraphQL type definitions.

##### About

It can be a single module or folder of modules. Multiple instances of module/folder-modules throughout your source tree is supported.

In dev mode graphql modules are synchronously found and imported at server boot time. At build time however static imports for all graphql modules are inlined for boot performance.

##### Aliases

n/a

## `app.ts`

Optional –– The entrypoint to your app

##### About

There can only be at most a single `app.ts`/`server.ts`/`service.ts` module in your source tree.

This module is optional **when** you just have schema modules and so `nexus` already knows how import them into the final build. Otherwise you'll need this module to import your custom modules etc.

##### Aliases

```
server.ts service.ts
```
