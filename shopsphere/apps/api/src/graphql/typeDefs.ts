export const typeDefs = `#graphql
  type Product {
    id: ID!
    sku: String!
    name: String!
    description: String!
    category: String!
    priceCents: Int!
    stock: Int!
    imageUrl: String!
  }

  type ProductPage {
    items: [Product!]!
    page: Int!
    pageSize: Int!
    total: Int!
  }

  type CartItem {
    productId: ID!
    name: String!
    priceCents: Int!
    imageUrl: String!
    quantity: Int!
  }

  type Cart {
    items: [CartItem!]!
    totalCents: Int!
  }

  type OrderItem {
    productId: ID!
    quantity: Int!
    unitPriceCents: Int!
  }

  type Order {
    id: ID!
    status: String!
    totalCents: Int!
    createdAt: String!
    items: [OrderItem!]!
  }

  type PublicUser {
    id: ID!
    email: String!
    name: String!
    role: String!
  }

  type AuthPayload {
    token: String!
    user: PublicUser!
  }

  type Query {
    products(search: String, category: String, page: Int, pageSize: Int): ProductPage!
    product(id: ID!): Product
    categories: [String!]!
    me: PublicUser
    cart: Cart!
    orders: [Order!]!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    addToCart(productId: ID!, quantity: Int): Cart!
    removeFromCart(productId: ID!): Cart!
    checkout: Order!
  }
`;
