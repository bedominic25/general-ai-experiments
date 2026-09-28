// Lightweight, dependency-free "embedding" for the RAG retrieval demo: a
// hashed bag-of-words/bigrams vector (the classic feature-hashing trick, as
// used by e.g. Vowpal Wabbit). It is deterministic, needs no external model
// or API key, and is good enough to distinguish product categories/attributes
// in a small curated catalog. Swap this module for a call to a real
// embeddings API (Voyage, OpenAI, Bedrock Titan, ...) to go to production -
// everything downstream (VectorStore, pgvector column width) only depends on
// EMBEDDING_DIMENSIONS, not on how the vector was produced.
export const EMBEDDING_DIMENSIONS = 256;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function fnv1aHash(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    vector[fnv1aHash(token) % EMBEDDING_DIMENSIONS] += 1;
  }
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    vector[fnv1aHash(bigram) % EMBEDDING_DIMENSIONS] += 0.5;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

/** Vectors from embed() are already L2-normalized, so cosine similarity is a plain dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}
