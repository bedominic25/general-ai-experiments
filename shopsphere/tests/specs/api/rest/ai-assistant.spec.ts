import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.describe("REST /api/ai", () => {
  test("chat works for anonymous (unauthenticated) sessions", async ({ request }) => {
    const res = await request.post("/api/ai/chat", {
      data: { sessionId: randomUUID(), message: "I need something warm for winter trail running" },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.provider).toBe("mock");
    expect(body.reply).toContain("TrailBlazer Winter Running Shoes");
    expect(body.retrievedProducts.length).toBeGreaterThan(0);
    expect(typeof body.latencyMs).toBe("number");
  });

  test("chat persists conversation history for a session", async ({ request }) => {
    const sessionId = randomUUID();
    await request.post("/api/ai/chat", { data: { sessionId, message: "hiking boots" } });
    await request.post("/api/ai/chat", { data: { sessionId, message: "wireless earbuds" } });

    const history = await (await request.get(`/api/ai/chat/${sessionId}`)).json();
    expect(history).toHaveLength(4); // 2 user turns + 2 assistant turns
    expect(history.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  test("rejects an empty message", async ({ request }) => {
    const res = await request.post("/api/ai/chat", { data: { sessionId: randomUUID(), message: "" } });
    expect(res.status()).toBe(400);
  });

  test("rejects a chat request without a sessionId", async ({ request }) => {
    const res = await request.post("/api/ai/chat", { data: { message: "hello" } });
    expect(res.status()).toBe(400);
  });

  test("retrieve exposes raw ranked matches without calling the LLM", async ({ request }) => {
    const res = await request.get("/api/ai/retrieve?q=noise+cancelling+earbuds");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches[0]).toEqual(expect.objectContaining({ productId: expect.any(String), score: expect.any(Number) }));
  });

  test("retrieve requires a non-empty query", async ({ request }) => {
    const res = await request.get("/api/ai/retrieve");
    expect(res.status()).toBe(400);
  });
});
