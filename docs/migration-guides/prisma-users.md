# Hello Prisma user!

Nexus is a feature rich GraphQL Framework. One of its hallmark features is how it helps you achieve a very high degree of type-safety as you implement your API. If you are a long-time Prisma user you can see it as a spiritual successor to the rich GraphQL experiences that Prisma 1 and even Graphcool offered. Nexus is still young, but growing fast.

If you haven't already, you should read the [Welcome to Nexus](/README) introduction.

## Vanilla Integration {docsify-ignore}

As a Prisma user you can easily integrate Prisma into Nexus yourself, take a look:

```ts
import { PrismaClient } from '@prisma/client'
import { schema } from 'nexus'

const db = new PrismaClient()

schema.addToContext(req => ({ db })) // exopse Prisma Client in all resolvers

schema.queryType({
  definition(t) {
    t.field('...', {
      type: '...'
      resolve(_, __, ctx) {
        ctx.db // <- Prisma Client
      }
    })
  }
})
```

Run `nexus dev` in one shell, and your usual `prisma` workflow in another. ✅

## Plugin! {docsify-ignore}

This is fine, but there's something better. The Nexus Prisma _plugin_ (`nexus-plugin-prisma`). It levels up your experience, including:

- Bundling the Prisma deps
- Running your Prisma generators
- Integrating your Prisma Client automatically, including into Nexus' test system
- Declarative APIs for projecting types from your Prisma schema onto your GraphQL Schema
- Declarative APIs for creating mutations and queries (including automatically implemented resolvers!)

If you haven't already, you should read the [Welcome to Nexus Prisma](/plugins/prisma) introduction.

## Learning Path {docsify-ignore}

1. Read [Welcome to Nexus](/README)
2. Do [The Nexus Tutorial](/tutorial/introduction)
3. If using the Prisma plugin (you should!) read [Welcome to Nexus Prisma](/plugins/prisma)

TL;DR

```
npm add nexus nexus-plugin-prisma
npm run nexus
```
