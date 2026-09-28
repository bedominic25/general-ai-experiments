import { test, expect, type APIRequestContext } from "@playwright/test";

async function registerUser(request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request.post("/api/auth/register", {
    data: { email, password: "Password123!", name: "Cart Test User" },
  });
  const body = await res.json();
  return { token: body.token as string, userId: body.user.id as string, email };
}

async function firstProductId(request: APIRequestContext, query: string): Promise<string> {
  const res = await request.get(`/api/products?q=${encodeURIComponent(query)}`);
  const body = await res.json();
  return body.items[0].id as string;
}

test.describe("REST /api/cart and /api/orders", () => {
  test("requires authentication", async ({ request }) => {
    expect((await request.get("/api/cart")).status()).toBe(401);
    expect((await request.post("/api/orders")).status()).toBe(401);
  });

  test("adding, viewing, and removing cart items", async ({ request }) => {
    const { token } = await registerUser(request, "cart-basic");
    const productId = await firstProductId(request, "yoga mat");

    const added = await request.post("/api/cart", {
      headers: { Authorization: `Bearer ${token}` },
      data: { productId, quantity: 2 },
    });
    expect(added.ok()).toBeTruthy();
    const addedBody = await added.json();
    expect(addedBody.items).toHaveLength(1);
    expect(addedBody.items[0].quantity).toBe(2);

    const fetched = await request.get("/api/cart", { headers: { Authorization: `Bearer ${token}` } });
    expect((await fetched.json()).totalCents).toBe(addedBody.totalCents);

    const removed = await request.delete(`/api/cart/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await removed.json()).items).toHaveLength(0);
  });

  test("rejects adding more items than are in stock", async ({ request }) => {
    const { token } = await registerUser(request, "cart-stock");
    const productId = await firstProductId(request, "yoga mat");

    const res = await request.post("/api/cart", {
      headers: { Authorization: `Bearer ${token}` },
      data: { productId, quantity: 999_999 },
    });
    expect(res.status()).toBe(400);
  });

  test("checkout creates an order, clears the cart, and decrements stock", async ({ request }) => {
    const { token } = await registerUser(request, "checkout-flow");
    const productId = await firstProductId(request, "compact camp stove");

    const beforeStock = (await (await request.get(`/api/products/${productId}`)).json()).stock as number;

    await request.post("/api/cart", { headers: { Authorization: `Bearer ${token}` }, data: { productId, quantity: 1 } });

    const orderRes = await request.post("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.items).toHaveLength(1);
    expect(order.status).toBe("placed");

    const cartAfter = await (await request.get("/api/cart", { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(cartAfter.items).toHaveLength(0);

    const afterStock = (await (await request.get(`/api/products/${productId}`)).json()).stock as number;
    expect(afterStock).toBe(beforeStock - 1);

    const orders = await (await request.get("/api/orders", { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(orders.find((o: { id: string }) => o.id === order.id)).toBeTruthy();
  });

  test("checkout with an empty cart is rejected", async ({ request }) => {
    const { token } = await registerUser(request, "checkout-empty");
    const res = await request.post("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(400);
  });

  test("each user's cart is isolated from other users'", async ({ request }) => {
    const userA = await registerUser(request, "cart-isolation-a");
    const userB = await registerUser(request, "cart-isolation-b");
    const productId = await firstProductId(request, "smart desk lamp");

    await request.post("/api/cart", {
      headers: { Authorization: `Bearer ${userA.token}` },
      data: { productId, quantity: 1 },
    });

    const cartB = await (await request.get("/api/cart", { headers: { Authorization: `Bearer ${userB.token}` } })).json();
    expect(cartB.items).toHaveLength(0);
  });
});
