import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import type { Express } from "express";
import { verifyToken } from "../auth/jwt.js";
import { typeDefs } from "./typeDefs.js";
import { resolvers, type GraphQLContext } from "./resolvers.js";

export async function mountGraphQL(app: Express): Promise<void> {
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await server.start();

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        const header = req.headers.authorization;
        if (header?.startsWith("Bearer ")) {
          try {
            return { user: verifyToken(header.slice("Bearer ".length)) };
          } catch {
            return {};
          }
        }
        return {};
      },
    }),
  );
}
