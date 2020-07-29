import { Config } from 'apollo-server-core'
import { SetRequired } from 'type-fest'

export type ApolloConfigEngine = Exclude<Config['engine'], undefined>

export type ApolloConfig<Base extends Config = Config> = SetRequired<
  Base,
  'context' | 'formatError' | 'introspection' | 'playground' | 'logger' | 'schema'
>
