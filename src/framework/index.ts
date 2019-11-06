import { ApolloServer } from "apollo-server-express";
import * as express from "express";
import * as nexus from "nexus";
import { getTypeDefs } from "./nexus";

export {
  objectType,
  inputObjectType,
  enumType,
  scalarType,
  unionType
} from "./nexus";

function makeSchema(): nexus.core.NexusGraphQLSchema {
  const config: nexus.core.SchemaConfig = {
    types: getTypeDefs(),
    outputs: false
  };
  return nexus.makeSchema(config);
}

export function createApp() {
  return {
    startServer() {
      const server = new ApolloServer({ schema: makeSchema() });
      const app = express();
      server.applyMiddleware({ app });

      app.listen({ port: 4000 }, () =>
        console.log(
          `🚀 Server ready at http://localhost:4000${server.graphqlPath}`
        )
      );
    }
  };
}
