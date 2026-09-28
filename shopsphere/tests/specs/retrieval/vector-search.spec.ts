import { test, expect } from "@playwright/test";

interface Match {
  productId: string;
  score: number;
}

async function retrieve(request: import("@playwright/test").APIRequestContext, q: string): Promise<Match[]> {
  const res = await request.get(`/api/ai/retrieve?q=${encodeURIComponent(q)}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).matches;
}

async function productName(request: import("@playwright/test").APIRequestContext, id: string): Promise<string> {
  return (await (await request.get(`/api/products/${id}`)).json()).name;
}

// Exercises the retrieval-database layer directly (bypassing the LLM), which
// is the piece a real "retrieval database" regression suite would pin: does
// the ranked candidate set stay relevant as the catalog/embedding logic
// evolves? See src/ai/vectorStore.ts for the Sqlite/PgVector implementations
// this endpoint sits on top of.
test.describe("Retrieval / RAG candidate ranking", () => {
  test("returns matches ranked best-first by cosine similarity", async ({ request }) => {
    const matches = await retrieve(request, "insulated winter shoes for cold trail running");
    expect(matches.length).toBeGreaterThan(0);
    for (let i = 1; i < matches.length; i += 1) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  test("ranks the topically closest product first for a clear-cut query", async ({ request }) => {
    const matches = await retrieve(request, "waterproof insulated winter running shoes for icy trails");
    const topName = await productName(request, matches[0].productId);
    expect(topName).toBe("TrailBlazer Winter Running Shoes");
  });

  test("keeps unrelated categories out of the top result for a specific query", async ({ request }) => {
    const matches = await retrieve(request, "noise cancelling wireless earbuds with long battery life");
    const topName = await productName(request, matches[0].productId);
    expect(topName).toBe("PulseBeat Wireless Earbuds");
  });

  test("is deterministic for the same query", async ({ request }) => {
    const [first, second] = await Promise.all([
      retrieve(request, "adjustable dumbbells for home workouts"),
      retrieve(request, "adjustable dumbbells for home workouts"),
    ]);
    expect(first).toEqual(second);
  });

  test("respects an explicit result count via the assistant's default top-K", async ({ request }) => {
    const matches = await retrieve(request, "products");
    expect(matches.length).toBeLessThanOrEqual(5);
  });
});
