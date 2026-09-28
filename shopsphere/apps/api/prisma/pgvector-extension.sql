-- Run once against the Postgres/pgvector database (see docker-compose.yml /
-- infra/terraform/rds.tf) after `prisma migrate deploy` has created the
-- relational tables. Prisma owns "Product" itself; this just bolts on the
-- vector column and ANN index that Prisma's schema.prisma cannot express.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS embedding_vec vector(256);

UPDATE "Product"
SET embedding_vec = embedding::vector
WHERE embedding_vec IS NULL;

CREATE INDEX IF NOT EXISTS product_embedding_vec_idx
  ON "Product" USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 100);
