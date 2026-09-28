import { test, expect, type APIRequestContext } from "@playwright/test";

async function gql(request: APIRequestContext, query: string, variables?: Record<string, unknown>, token?: string) {
  const res = await request.post("/graphql", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data: { query, variables },
  });
  const json = await res.json();
  return { status: res.status(), ...json };
}

test.describe("GraphQL: products & categories", () => {
  test("products query returns items and pagination fields", async ({ request }) => {
    const { data, errors } = await gql(
      request,
      `query { products { items { id name priceCents } page pageSize total } }`,
    );

    expect(errors).toBeUndefined();
    expect(data.products.items.length).toBeGreaterThan(0);
    expect(data.products.page).toBe(1);
  });

  test("products query filters by search term", async ({ request }) => {
    const { data } = await gql(
      request,
      `query($search: String) { products(search: $search) { items { name } } }`,
      { search: "coffee" },
    );

    expect(data.products.items.some((p: { name: string }) => p.name.includes("Coffee"))).toBe(true);
  });

  test("product(id) resolves a single product, null for unknown ids", async ({ request }) => {
    const list = await gql(request, `query { products { items { id } } }`);
    const id = list.data.products.items[0].id;

    const found = await gql(request, `query($id: ID!) { product(id: $id) { id name } }`, { id });
    expect(found.data.product.id).toBe(id);

    const missing = await gql(request, `query { product(id: "nope") { id } }`);
    expect(missing.data.product).toBeNull();
  });

  test("categories query lists distinct categories", async ({ request }) => {
    const { data } = await gql(request, `query { categories }`);
    expect(data.categories).toEqual(expect.arrayContaining(["footwear", "books"]));
  });

  test("me is null when unauthenticated", async ({ request }) => {
    const { data } = await gql(request, `query { me { id } }`);
    expect(data.me).toBeNull();
  });
});
