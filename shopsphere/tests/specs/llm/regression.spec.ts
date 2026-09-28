import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Golden-response regression suite for the RAG pipeline, run against the
// deterministic MockLlmProvider (LLM_PROVIDER=mock in playwright.config.ts's
// webServer). Mirrors the golden-case pattern from ../../../llm-eval-framework
// one level up in this monorepo's parent (general-ai-experiments), adapted to
// pin the shopping assistant's retrieval+generation contract instead of a
// bare LLM call. A real-API companion lives in live.spec.ts.
const CASES: Array<{ query: string; expectContains: string[] }> = [
  {
    query: "I need something warm for winter trail running",
    expectContains: ["TrailBlazer Winter Running Shoes", "$89.99"],
  },
  {
    query: "noise cancelling wireless earbuds with long battery life",
    expectContains: ["PulseBeat Wireless Earbuds"],
  },
  {
    query: "a HEPA air purifier for a bedroom",
    expectContains: ["QuietHum Air Purifier"],
  },
  {
    query: "a tent for a 3 season backpacking trip",
    expectContains: ["AlpineShield 3-Season Tent"],
  },
];

test.describe("LLM regression (mock provider, deterministic)", () => {
  for (const { query, expectContains } of CASES) {
    test(`replies with the expected top recommendation for: "${query}"`, async ({ request }) => {
      const res = await request.post("/api/ai/chat", {
        data: { sessionId: randomUUID(), message: query },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.provider).toBe("mock");

      for (const fragment of expectContains) {
        expect(body.reply).toContain(fragment);
      }
    });
  }

  test("records the retrieved products and latency for observability", async ({ request }) => {
    const res = await request.post("/api/ai/chat", {
      data: { sessionId: randomUUID(), message: "hiking boots for muddy terrain" },
    });
    const body = await res.json();

    expect(body.retrievedProducts.length).toBeGreaterThan(0);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("gives a graceful, non-empty reply for an out-of-catalog request", async ({ request }) => {
    const res = await request.post("/api/ai/chat", {
      data: { sessionId: randomUUID(), message: "a helicopter" },
    });
    const body = await res.json();
    expect(body.reply.length).toBeGreaterThan(0);
  });
});
