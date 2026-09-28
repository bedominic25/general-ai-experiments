import { describe, expect, it } from "vitest";
import { cosineSimilarity, embed, EMBEDDING_DIMENSIONS } from "../../src/ai/vectorizer.js";

describe("vectorizer", () => {
  it("produces a fixed-dimension, L2-normalized vector", () => {
    const v = embed("Winter running shoes for icy trails");
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic for the same input", () => {
    expect(embed("noise cancelling wireless earbuds")).toEqual(embed("noise cancelling wireless earbuds"));
  });

  it("ranks a topically-similar product above an unrelated one", () => {
    const query = embed("insulated winter shoes for cold trail running");
    const winterShoes = embed("TrailBlazer Winter Running Shoes insulated waterproof running shoes built for cold-weather trails");
    const coffeeSet = embed("BrewPeak Pour-Over Coffee Set ceramic pour-over dripper and carafe set");

    expect(cosineSimilarity(query, winterShoes)).toBeGreaterThan(cosineSimilarity(query, coffeeSet));
  });

  it("returns an all-zero vector for empty input without dividing by zero", () => {
    const v = embed("   ");
    expect(v.every((x) => x === 0)).toBe(true);
  });
});
