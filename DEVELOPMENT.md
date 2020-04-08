# Development

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
/docs         -- The website
/test         -- Integration tests
/src
  /cli        -- CLI codebase
  /framework  -- Runtime codebase
  /utils      -- Non-discrete modules (may have state, tight coupling)
  /lib        -- Discrete modules
```

#### `lib`

The layout of a typical lib module looks like so:

```
/lib
  /<module-name>
    /index.ts        -- Export-only module, the public interface
    /index.spec.ts   -- Tests against the public interface. Integration in the sense
                        that it is agnostic to the unit or units making up the lib.
    /*.ts            -- The modules making up the lib
    /*.spec.ts       -- Optional tests. Please prioritize `index.spec.ts`
```

Be careful about lib modules depending upon one another excessively. The more complex the dependency graph the harder it _can_ become to reason about the modules. But if there is non-trivial re-use to be had and/or just a simple/clean and logical dependency then go for it.

The built-in exception to this heuristic is `lib/utils` which can be thought of as a bespoke `lodash` for our lib components. Use it for small utilities, which might be shared, are very generic, and are not numerous enough to justify their own dedicated lib module. For example there is a utility to make text span a given length using given pad character.

<br>

### Testing

We use GitHub Actions.

#### Unit

```bash
yarn test:unit
yarn dev:test      # watch mode
```

- Live under `/src` separated by and colocated with the respective module they test.

- Unit tests run in CI against every commit.

#### System

```
yarn test system/create-prisma
yarn test system/kitchen
```

- Live under `/test/system`

- Almost like E2E but they work with the local package code (whereas E2E would work with an actually published package).

- These are useful because they provide many of the functional checks of E2E with a lower barrier to running, namely needing a published package. For example pull-requests made by community members cannot trigger E2E tests because that would require publishing and GitHub actions has no way for [PRs from forks to access secrets](https://github.community/t5/GitHub-Actions/Allow-secrets-to-be-shared-with-trusted-Actions/td-p/34278).

- You must run `yarn build` right before running these tests.

#### E2E

```
yarn test e2e/create-prisma
yarn test e2e/kitchen
```

- Environment variables

- Live under `/test/e2e`

  - `E2E_NEXUS_VERSION` – which version of Nexus to install during app creation

- E2E tests run in CI against every commit _after the package has been published_. These are preview and pr releases so its acceptable, and doing it this way provides a true smoke test of if the _real_ user journey works end to end.

- E2E tests can be run on your machine. They default to working with `latest` dist-tag. Use `E2E_NEXUS_VERSION` env var to set the desired version to test against.

<br>

### Continuous Delivery

- We use [`dripip`](https://github.com/prisma-labs/dripip) to make releases.

- Every PR commit results in:

  1. Pre-Release of pattern:

     ```
     0.0.0-pr.<pr-num>.<build-num>.<short-sha>`
     ```

  1. Update to an npm dist tag of pattern

     ```
     pr.<pr-num>`
     ```

- Every trunk commit results in a

  1. Pre-Release of pattern:

     ```
     <next-version>-next.<build-num>
     ```

  1. Update to an npm dist tag of pattern

     ```
     next
     ```

- Stable releases are cut _manually_.

- Any release type can be run manually:

  ```
  yarn release:preview
  yarn release:stable
  yarn release:pr
  ```

### Website

- We use [docsifyjs/docsify](https://github.com/docsifyjs/docsify).
- There is no build step
- Commits to master will trigger deployment (via `gh-pages`, no ci/cd on our part)
- Navigation is manually managed in `_sidebar.md`
- Cover page is managed in `_coverpage.md`
- Configuration and significant styling customizations are kept in `index.html`

#### Getting started

1. Fix bin

   There is currently [a bug](https://github.com/docsifyjs/docsify-cli/issues/88) with `docsify-cli` requiring the following manual fix after installation.

   ```
   vim ./node_modules/.bin/docsify
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

Refer to https://github.com/graphql-nexus/examples

#### Developing `create app`

The strategy is to use a file path for the nexus dependency.

The pattern is thus:

```
CREATE_APP_CHOICE_NEXUS_VERSION='<path/to/nexus>' node <path/to/nexus>/dist/cli/main.js create app
```
