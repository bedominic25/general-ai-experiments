import { GraphQLError } from "graphql";
import { prisma } from "../db/client.js";
import { addToCart, getCart, removeFromCart } from "../cart/service.js";
import { checkout, listOrders } from "../orders/service.js";
import { AuthError, loginUser, registerUser } from "../auth/service.js";
import { listCategories, listProducts, getProductById } from "../products/service.js";
import type { AuthTokenPayload } from "../auth/jwt.js";

export interface GraphQLContext {
  user?: AuthTokenPayload;
}

function requireUser(ctx: GraphQLContext): AuthTokenPayload {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return ctx.user;
}

export const resolvers = {
  Query: {
    products: (_: unknown, args: { search?: string; category?: string; page?: number; pageSize?: number }) =>
      listProducts({ search: args.search, category: args.category, page: args.page, pageSize: args.pageSize }),
    product: (_: unknown, args: { id: string }) => getProductById(args.id),
    categories: () => listCategories(),
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      const user = await prisma.user.findUnique({ where: { id: ctx.user.sub } });
      return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
    },
    cart: (_: unknown, __: unknown, ctx: GraphQLContext) => getCart(requireUser(ctx).sub),
    orders: (_: unknown, __: unknown, ctx: GraphQLContext) => listOrders(requireUser(ctx).sub),
  },
  Mutation: {
    register: (_: unknown, args: { email: string; password: string; name: string }) =>
      registerUser(args.email, args.password, args.name).catch((err) => {
        if (err instanceof AuthError) {
          throw new GraphQLError(err.message, { extensions: { code: "BAD_REQUEST" } });
        }
        throw err;
      }),
    login: (_: unknown, args: { email: string; password: string }) =>
      loginUser(args.email, args.password).catch((err) => {
        if (err instanceof AuthError) {
          throw new GraphQLError(err.message, { extensions: { code: "UNAUTHENTICATED" } });
        }
        throw err;
      }),
    addToCart: (_: unknown, args: { productId: string; quantity?: number }, ctx: GraphQLContext) =>
      addToCart(requireUser(ctx).sub, args.productId, args.quantity ?? 1),
    removeFromCart: (_: unknown, args: { productId: string }, ctx: GraphQLContext) =>
      removeFromCart(requireUser(ctx).sub, args.productId),
    checkout: (_: unknown, __: unknown, ctx: GraphQLContext) => checkout(requireUser(ctx).sub),
  },
};
