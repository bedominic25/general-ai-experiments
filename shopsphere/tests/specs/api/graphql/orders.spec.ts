import { test, expect, type APIRequestContext } from "@playwright/test";

async function gql(request: APIRequestContext, query: string, variables?: Record<string, unknown>, token?: string) {
  const res = await request.post("/graphql", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data: { query, variables },
  });
  const json = await res.json();
  return { status: res.status(), ...json };
}

async function registerViaGraphQL(request: APIRequestContext) {
  const email = `gql-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data } = await gql(
    request,
    `mutation($email: String!, $password: String!, $name: String!) {
      register(email: $email, password: $password, name: $name) { token user { id email } }
    }`,
    { email, password: "Password123!", name: "GraphQL Test User" },
  );
  return { token: data.register.token as string, email };
}

test.describe("GraphQL: auth, cart, checkout", () => {
  test("register then login returns matching tokens' identity", async ({ request }) => {
    const { email } = await registerViaGraphQL(request);

    const { data } = await gql(
      request,
      `mutation($email: String!, $password: String!) { login(email: $email, password: $password) { token user { email } } }`,
      { email, password: "Password123!" },
    );

    expect(data.login.user.email).toBe(email);
  });

  test("cart mutations require authentication", async ({ request }) => {
    const { errors } = await gql(request, `mutation { checkout { id } }`);
    expect(errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  test("addToCart, cart query, removeFromCart, and checkout all work over GraphQL", async ({ request }) => {
    const { token } = await registerViaGraphQL(request);

    const productsRes = await gql(request, `query { products(search: "insulated jacket") { items { id name priceCents } } }`);
    const productId = productsRes.data.products.items[0].id;

    const added = await gql(
      request,
      `mutation($productId: ID!) { addToCart(productId: $productId, quantity: 1) { items { productId quantity } totalCents } }`,
      { productId },
      token,
    );
    expect(added.data.addToCart.items).toHaveLength(1);

    const cart = await gql(request, `query { cart { items { productId } totalCents } }`, undefined, token);
    expect(cart.data.cart.items).toHaveLength(1);

    const order = await gql(request, `mutation { checkout { id status totalCents items { productId quantity } } }`, undefined, token);
    expect(order.data.checkout.status).toBe("placed");
    expect(order.data.checkout.items).toHaveLength(1);

    const emptiedCart = await gql(request, `query { cart { items { productId } } }`, undefined, token);
    expect(emptiedCart.data.cart.items).toHaveLength(0);

    const orders = await gql(request, `query { orders { id } }`, undefined, token);
    expect(orders.data.orders.some((o: { id: string }) => o.id === order.data.checkout.id)).toBe(true);
  });
});
