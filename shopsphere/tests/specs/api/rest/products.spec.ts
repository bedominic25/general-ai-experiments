import { test, expect } from "@playwright/test";

test.describe("REST /api/products", () => {
  test("lists products with pagination metadata", async ({ request }) => {
    const res = await request.get("/api/products");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body).toMatchObject({ page: 1, pageSize: 12 });
    expect(body.total).toBeGreaterThanOrEqual(body.items.length);
  });

  test("never leaks the internal embedding vector", async ({ request }) => {
    const res = await request.get("/api/products");
    const body = await res.json();
    for (const item of body.items) {
      expect(item.embedding).toBeUndefined();
    }
  });

  test("filters by free-text search", async ({ request }) => {
    const res = await request.get("/api/products?q=coffee");
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.some((p: { name: string }) => p.name === "BrewPeak Pour-Over Coffee Set")).toBe(true);
  });

  test("filters by category", async ({ request }) => {
    const res = await request.get("/api/products?category=footwear");
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((p: { category: string }) => p.category === "footwear")).toBe(true);
  });

  test("returns a single product by id", async ({ request }) => {
    const list = await (await request.get("/api/products?q=coffee")).json();
    const productId = list.items[0].id;

    const res = await request.get(`/api/products/${productId}`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).id).toBe(productId);
  });

  test("returns 404 for an unknown product id", async ({ request }) => {
    const res = await request.get("/api/products/does-not-exist");
    expect(res.status()).toBe(404);
  });

  test("lists distinct categories", async ({ request }) => {
    const res = await request.get("/api/products/categories");
    const body = await res.json();
    expect(body.categories).toEqual(expect.arrayContaining(["footwear", "electronics", "outdoor"]));
  });
});
