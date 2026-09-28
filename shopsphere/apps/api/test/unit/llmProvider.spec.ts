import { describe, expect, it } from "vitest";
import { MockLlmProvider } from "../../src/ai/llmProvider.js";

describe("MockLlmProvider", () => {
  const provider = new MockLlmProvider();

  it("names the top-ranked retrieved product first", async () => {
    const reply = await provider.generateReply({
      query: "warm boots for hiking in snow",
      history: [],
      retrieved: [
        { id: "1", name: "SummitGrip Hiking Boots", priceCents: 12999, description: "Rugged ankle-support hiking boots." },
        { id: "2", name: "UrbanStride Everyday Sneakers", priceCents: 6499, description: "Lightweight everyday sneakers." },
      ],
    });

    expect(reply).toContain("SummitGrip Hiking Boots");
    expect(reply).toContain("$129.99");
  });

  it("asks a clarifying question when nothing was retrieved", async () => {
    const reply = await provider.generateReply({ query: "a spaceship", history: [], retrieved: [] });
    expect(reply).toMatch(/couldn't find/i);
  });

  it("is deterministic for identical context (regression-safe)", async () => {
    const ctx = {
      query: "quiet air purifier",
      history: [],
      retrieved: [{ id: "3", name: "QuietHum Air Purifier", priceCents: 9999, description: "HEPA air purifier." }],
    };
    expect(await provider.generateReply(ctx)).toEqual(await provider.generateReply(ctx));
  });
});
