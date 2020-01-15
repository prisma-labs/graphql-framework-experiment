# graphql-santa <!-- omit in toc -->

<br>

## Documentation <!-- omit in toc -->

https://prisma-labs.github.io/graphql-santa

<br>

## Development

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Code Architecture](#code-architecture)
- [Testing](#testing)
- [Releasing](#releasing)
- [Website](#website)
- [Workflow Tips](#workflow-tips)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<br>

### Code Architecture

#### Overview

- Roughly speaking we have three distinct levels of code:

  1. `src/{cli, framework}` Top level modules coded directly against their respective domain.

  2. `src/utils/*` Mid level modules that might provide some conveniences or encapsulate concerns shared across `framework` and `cli`.

  3. `src/lib/*` Discrete modules that stand alone conceptually and technically.

- Each level builds on the one below it.

- One can think of code as evolving from level 1 down toward level 3.

  Of course the natural place for some code is level 1. On the other hand we often don't know at first what a generic solution looks like. So level 3 tends to be grown into, rather than started from.

- You could see a level 4 here as npm registry, where we _fully_ extract a library. That is not an explicit goal, just a tip for the mental model.

- Overall status of the codebase is in a state of refactoring. `utils`, `watcher`, and more are undergoing source restructuring in the near future.

#### Layout Overview

```
/docs         The website
/test         Integration tests
/src
  /cli        CLI codebase
  /framework  Runtime codebase
  /utils      Non-discrete modules (may have state, tight coupling)
  /lib        Discrete modules
```

#### `lib/<module>` Layout

```
/index.ts        Export-only module, the public interface

/index.spec.ts   Tests against the public interface. Integration in the sense
                 that it is agnostic to the unit or units making up the lib.

/*.ts            The modules making up the lib
/*.spec.ts       Optional tests. Please prioritize `index.spec.ts`
```

<br>

### Testing

There are unit tests and integration tests. `yarn test` runs them all. Beware that the integration tests run slowly. `yarn dev:test` runs only unit for this reason. Testing on CI is not yet setup.

#### Unit

```
yarn test:unit
```

We co-locate unit tests with their respective modules. These can be run via `yarn test:unit`.

#### Integration

```
yarn test:integration
```

Integration tests rely on `yarn link`. This means those integration tests cannot work on a machine that has not done `yarn link` inside the root of the cloned repo.

<br>

### Releasing

We use [`dripip`](https://github.com/prisma-labs/dripip) to make releases. There is currently a bug preventing the yarn release scripts from working. So `yarn release:preview` etc. will fail. The issue is being tracked as upstream [here](https://github.com/prisma-labs/dripip/issues/23). For now, you need to run from `node_modules/.bin` manually:

```
$ node_modules/.bin/dripip preview
$ node_modules/.bin/dripip stable
```

CI/CD preview releases are not setup yet.

### Website

- We use [docsifyjs/docsify](https://github.com/docsifyjs/docsify).
- There is no build step
- Commits to master will trigger deployment (via `gh-pages`, no ci/cd on our part)
- Navigation is manually managed in `_sidebar.md`
- Cover page is managed in `_coverpage.md`
- Configuration and significant styling customizations are kept in `index.html`

#### Getting started

1. Install `docsify-cli`

   There is currently [a bug](https://github.com/docsifyjs/docsify-cli/issues/88) with `docsify-cli` requiring the following manual fix after installation. To make this less painful, install globally so you should only have to do this once.

   ```
   yarn global add docsify
   ```

   ```
   vim /usr/local/bin/docsify
   :se ff=unix
   :wq
   ```

2. Boot docs dev to preview your changes locally

   ```
   yarn docs:dev
   ```

<br>

### Workflow Tips

#### Working With Example Apps via Linking

Refer to https://github.com/prisma-labs/graphql-santa-examples

#### Working with create command

In any example you can use this workflow:

```
rm -rf test-create && mcd test-create && ../node_modules/.bin/graphql-santa create
```
