import { test, expect } from "@playwright/test";
import { ClaudeProvider } from "../../../apps/api/src/ai/llmProvider.js";

interface RetrievedMatch {
  productId: string;
}

interface Product {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

const shouldRun = process.env.LIVE_LLM_TESTS === "true" && Boolean(process.env.ANTHROPIC_API_KEY);

// Opt-in suite that calls the REAL Anthropic API - excluded from `npm run
// test:e2e` / CI by default (see .github/workflows/ci.yml) and only runs via
// `npm run test:llm:live` with LIVE_LLM_TESTS=true and a real
// ANTHROPIC_API_KEY set. Retrieval still comes from the already-running
// (mock-provider) API's /api/ai/retrieve so we exercise the real generation
// step against our real catalog without needing a second server topology.
test.describe("LLM live (real Claude API)", () => {
  test.skip(!shouldRun, "Set LIVE_LLM_TESTS=true and ANTHROPIC_API_KEY to run this suite.");

  test("produces a grounded recommendation from real retrieval context", async ({ request }) => {
    const query = "insulated winter shoes for cold trail running";

    const retrieveRes = await request.get(`/api/ai/retrieve?q=${encodeURIComponent(query)}`);
    const { matches } = (await retrieveRes.json()) as { matches: RetrievedMatch[] };

    const products = await Promise.all(
      matches.slice(0, 3).map(async (m) => (await (await request.get(`/api/products/${m.productId}`)).json()) as Product),
    );

    const provider = new ClaudeProvider(process.env.ANTHROPIC_API_KEY!, process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5");
    const reply = await provider.generateReply({
      query,
      history: [],
      retrieved: products.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, description: p.description })),
    });

    expect(reply.length).toBeGreaterThan(0);
    expect(products.some((p) => reply.includes(p.name))).toBe(true);
  });
});
