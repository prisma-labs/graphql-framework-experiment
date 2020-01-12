# graphql-santa

`graphql-santa` is a GraphQL API framework.

If you're looking for the docs you can find them [here](https://prisma-labs.github.io/graphql-santa/#/README).

## Development

### Overview

```
yarn
yarn test
yarn dev
```

<br>

### Website

We currently use [docsifyjs/docsify](https://github.com/docsifyjs/docsify). We deploy to `gh-pages`.

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

#### Notes

- There is no build step
- Commits to master will trigger deployment (via `gh-pages`, no ci/cd on our part)

<br>

### Testing

Integration tests rely on `npm link`. This means those integration tests cannot
work on a machine that has not done `npm link` inside the root of the cloned
repo.

The reason we do not use `yarn link` is that yarn [does not symlink the bin into
local node_modules](https://github.com/yarnpkg/yarn/issues/5713).

### Working With Example Apps via Linking

Refer to https://github.com/prisma-labs/graphql-santa-examples

### Working with create command

In any example you can use this workflow:

```
rm -rf test-create && mcd test-create && ../node_modules/.bin/graphql-santa create
```
