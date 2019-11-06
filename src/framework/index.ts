import { ApolloServer } from "apollo-server-express";
import * as express from "express";
import { makeSchema } from "./nexus";

export {
  objectType,
  inputObjectType,
  enumType,
  scalarType,
  unionType
} from "./nexus";

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
