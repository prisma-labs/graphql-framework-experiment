import { ApolloServer, ApolloServerExpressConfig } from 'apollo-server-express'
import { ApolloConfig } from './types'

export class ApolloServerExpress extends ApolloServer {
  constructor(config: ApolloConfig<ApolloServerExpressConfig>) {
    super(config)
  }
}
