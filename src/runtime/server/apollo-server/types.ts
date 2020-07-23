import { Config } from 'apollo-server-core'
import { SetRequired } from 'type-fest'

export type ApolloConfig<Base extends Config = Config> = SetRequired<
  Base,
  'context' | 'formatError' | 'introspection' | 'playground' | 'logger' | 'schema'
>
