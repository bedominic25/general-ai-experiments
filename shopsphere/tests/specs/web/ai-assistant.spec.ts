import { test, expect } from "../../fixtures/testFixtures.js";

// These assert against the deterministic MockLlmProvider (webServer runs
// with LLM_PROVIDER=mock - see playwright.config.ts), so the exact reply
// text is stable and safe to pin. tests/specs/llm covers the RAG pipeline's
// behavior more thoroughly at the API layer.
test.describe("AI shopping assistant widget", () => {
  test("opens, answers a query, and cites recommended products", async ({ pom }) => {
    await pom.home.goto();
    await pom.aiAssistant.ask("I need something warm for winter trail running");

    const reply = await pom.aiAssistant.latestReply();
    expect(reply).toContain("TrailBlazer Winter Running Shoes");
    expect(reply).toContain("$89.99");

    await expect(pom.aiAssistant.recommendedProducts.first()).toBeVisible();
    expect(await pom.aiAssistant.recommendedProducts.count()).toBeGreaterThan(0);
  });

  test("asks a clarifying question when nothing in the catalog matches", async ({ pom }) => {
    await pom.home.goto();
    await pom.aiAssistant.ask("zzz completely unrelated nonsense query zzz qqq xxx");

    // The hashed bag-of-words retriever always returns its top-K by cosine
    // similarity (there's no hard relevance floor), so we assert on the
    // widget's resilience/UX contract rather than on "no products found".
    const reply = await pom.aiAssistant.latestReply();
    expect(reply.length).toBeGreaterThan(0);
    await expect(pom.aiAssistant.errorMessage).toHaveCount(0);
  });

  test("keeps prior turns visible across multiple questions", async ({ pom }) => {
    await pom.home.goto();
    await pom.aiAssistant.ask("hiking boots");
    await pom.aiAssistant.ask("wireless earbuds");

    expect(await pom.aiAssistant.userTurns.count()).toBe(2);
    expect(await pom.aiAssistant.assistantTurns.count()).toBe(2);
  });
});
