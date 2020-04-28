## Build Flow

1. The app layout is calculated  
   We discover things like where the entrypoint is, if any, and where graphql modules are, if any.
1. Worktime plugins are loaded (see [Plugin Loading Flow](#plugin-loading-flow))
1. Typegen is acquired  
   This step is about processes that reflect upon the app's source code to extract type information that will be automatically used in other parts of the app. This approach is relatively novel among Node tools. There are dynamic and static processes. The static ones use the TypeScript compiler API while the dynamic ones literally run the app with node in a special reflective mode.

   Dynamic has the benefit of being able to produce types that IDE's can pick up for use in not just TypeScript but also JavaScript. It works for the schema typegen because the GraphQL Schema builders permit generating accurate derived TypeScript. Dynamic works regardless of the abstractions users through over them. On the downside, dynamic is riskier because runtime errors in the app can halt its completion. When the types to be generated are based upon arbitrary code, the task becomes one of effectively re-writing TypeScript and thus impractical.

   Static doesn't have to deal with the unpredictabilities of running an app and so has the benefit of being easier to reason about in a sense. It also has the benefit of extracting accurate type information using the native TS system whereas dynamic relies on building TS types from scratch. This makes static a fit for arbitrary code. On the downside, robust AST processing is hard work, and so, so far, static restricts how certain expressions can be written, otherwise AST traversal fails.

   1. A start module is created in memory. It imports the entrypoint and all graphql modules. It registers an extension hook to transpile the TypeScript app on the fly as it is run. The transpilation uses the project's tsconfig but overrides target and module so that it is runnable by Node (10 and up). Specificaly es2015 target and commonjs module. For example if user had module of `esnext` the transpilation result would not be runnable by Node.
   1. The start module is run in a sub-process for maximum isolation. (we're looking at running within workers [#752](https://github.com/graphql-nexus/nexus/issues/752))
   1. In parallel, a TypeScript instance is created and the app source is statically analyzed to extract context types. This does not require running the app at all. TypeScript cache called tsbuildinfo is stored under `node_modules/.nexus`.

1. A new TypeScript instance is created so that the types generated in the previous step are picked up by the checker. This should be faster because it reuses the TypeScript cache created in the previous step.
1. The app is type checked
1. The app is transpiled
1. The app is emitted into `node_modules/.build`. This convention keeps derived files in a well known generally ignored location.
1. A production-oriented start module is generated differing in the following ways:
   - paths are relative
   - typescript not hooked into module extensions
   - plugins are imported for tree-shaking

## Plugin Loading Flow

todo  
what follows is a stub

1. capture the used plugins in the app
1. validate entrypoints
1. transform entrypoints into manifests
1. for each dimension (work, test, run) in the manifest
   1. import it
   1. catch any import errors
   1. validate imported value
   1. load plugin
   1. catch any load errors
