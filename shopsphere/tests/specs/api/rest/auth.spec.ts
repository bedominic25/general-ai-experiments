import { test, expect } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test.describe("REST /api/auth", () => {
  test("registers a new user and returns a usable token", async ({ request }) => {
    const email = uniqueEmail("rest-register");

    const res = await request.post("/api/auth/register", {
      data: { email, password: "Password123!", name: "REST Test User" },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email, name: "REST Test User", role: "customer" });
  });

  test("rejects registration with an already-used email", async ({ request }) => {
    const email = uniqueEmail("rest-dup");
    await request.post("/api/auth/register", { data: { email, password: "Password123!", name: "First" } });

    const res = await request.post("/api/auth/register", {
      data: { email, password: "Password123!", name: "Second" },
    });

    expect(res.status()).toBe(409);
  });

  test("rejects registration with a malformed payload", async ({ request }) => {
    const res = await request.post("/api/auth/register", { data: { email: "not-an-email", password: "short" } });
    expect(res.status()).toBe(400);
  });

  test("logs in with correct credentials", async ({ request }) => {
    const email = uniqueEmail("rest-login");
    await request.post("/api/auth/register", { data: { email, password: "Password123!", name: "Login User" } });

    const res = await request.post("/api/auth/login", { data: { email, password: "Password123!" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).token).toEqual(expect.any(String));
  });

  test("rejects login with the wrong password", async ({ request }) => {
    const email = uniqueEmail("rest-badlogin");
    await request.post("/api/auth/register", { data: { email, password: "Password123!", name: "Bad Login User" } });

    const res = await request.post("/api/auth/login", { data: { email, password: "wrong-password" } });
    expect(res.status()).toBe(401);
  });
});
