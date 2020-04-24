## Working With `tsconfig.json`

- Nexus honours settings within `tsconfig.json`.
- This ensures that Nexus and your IDE perform identical static analysis. If no `tsconfig.json` is present then Nexus will scaffold one for you.
- Nexus project layout interacts with `tsconfig.json` in the following ways.

##### Project Root

- Project Root is the CWD (current working directory) for all CLI invocatons.
- Nexus ([like VSCode](https://vscode.readthedocs.io/en/latest/languages/typescript/#typescript-files-and-projects)) considers the folder containing a `tsconfig.json` to be the project root.

##### Source Root

- Source Root is the base from which your source code layout starts. So, all of your app code must live within the source root. Your JavaScript build output layout will mirror it.
- Source Root is defined by setting `compilerOptions.rootDir` and adding its value also to the `includes` array. For detail into why it works like this see [microsoft/TypeScript#9858](https://github.com/microsoft/TypeScript/issues/9858#issuecomment-533287263) and this [StackOverflow answer](https://stackoverflow.com/questions/57333825/can-you-pull-in-excludes-includes-options-in-typescript-compiler-api).
- If you do not specify it then Nexus will scaffold its value for you. It will default to being the same directory as where `tsconfig.json` resides. In other words, project root. This defualt mirrors `tsc` default behaviour. The `includes` array will be scaffolded as well.
- Nexus requires that the `includes` array does not contain modules outside the source root. This mirrors `tsc`.

##### Out Root

- Out Root is the place where the transpiled TypeScript (to JavaScript) modules will be emitted to. The folder structure mimicks that of the source root.
- Out Root is defined by setting `compilerOptions.outDir`.
- If you do not specify it then Nexus will default to `node_modules/.build`. Unlike with `rootDir` Nexus will not scaffold the default into your `tsconfig.json` because its presence has no impact upon VSCode.
- You can override its value interactively with `nexus build --out`.

## Conventions

Nexus imposes a few requirements about how you structure your codebase.

### Schema Module(s)

##### Pattern

A `graphql` module or directory of modules `graphql.ts` `graphql/*.ts`.

This may be repeated multiple times in your source tree.

##### About

This convention is optional if entrypoint is present, required otherwise.

This is where you should write your GraphQL type definitions.

In dev mode the modules are synchronously found and imported when the server starts. Conversely, at build time, codegen runs making the modules statically imported. This is done to support tree-shaking and decrease application start time.

### Entrypoint

##### Pattern

A module, anywhere in your source directory, named `app.ts`.

##### About

This convention is optional if schema modules are present, required otherwise.
