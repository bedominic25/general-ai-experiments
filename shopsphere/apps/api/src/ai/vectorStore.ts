import { prisma, isPostgres } from "../db/client.js";
import { cosineSimilarity } from "./vectorizer.js";

export interface RetrievedMatch {
  productId: string;
  score: number;
}

export interface VectorStore {
  search(queryEmbedding: number[], topK: number): Promise<RetrievedMatch[]>;
}

/**
 * Default retrieval backend: loads embeddings from the same relational table
 * (SQLite locally / in CI - see prisma/schema.prisma) and ranks in-process.
 * Fine for a catalog of this size; not what you'd run at Amazon scale, which
 * is exactly why PgVectorStore below exists as the production swap-in.
 */
export class SqliteVectorStore implements VectorStore {
  async search(queryEmbedding: number[], topK: number): Promise<RetrievedMatch[]> {
    const products = await prisma.product.findMany({ select: { id: true, embedding: true } });

    const scored = products.map((p) => ({
      productId: p.id,
      score: cosineSimilarity(queryEmbedding, JSON.parse(p.embedding) as number[]),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

/**
 * Production retrieval backend: real ANN search via the pgvector extension.
 * Requires the companion migration in prisma/pgvector-extension.sql to have
 * run once against the target Postgres database (adds the `embedding_vec
 * vector(256)` column + an ivfflat index - see infra/terraform/rds.tf and
 * docker-compose.yml for where that database comes from). Prisma's schema
 * stays provider-agnostic (embedding stored as JSON text) because Prisma has
 * no native `vector` column type; this store talks to that extra column with
 * raw SQL instead.
 */
export class PgVectorStore implements VectorStore {
  async search(queryEmbedding: number[], topK: number): Promise<RetrievedMatch[]> {
    const literal = `[${queryEmbedding.join(",")}]`;
    const rows = await prisma.$queryRawUnsafe<{ id: string; score: number }[]>(
      `SELECT id, 1 - (embedding_vec <=> $1::vector) AS score
       FROM "Product"
       ORDER BY embedding_vec <=> $1::vector
       LIMIT $2`,
      literal,
      topK,
    );
    return rows.map((r) => ({ productId: r.id, score: r.score }));
  }
}

let store: VectorStore | undefined;

export function getVectorStore(): VectorStore {
  if (!store) {
    store = isPostgres() ? new PgVectorStore() : new SqliteVectorStore();
  }
  return store;
}
