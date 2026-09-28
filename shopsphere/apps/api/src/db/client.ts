import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function isPostgres(): boolean {
  return process.env.DATABASE_URL?.startsWith("postgres") ?? false;
}

// SQLite's default journal mode serializes writers; a concurrent writer
// gets SQLITE_BUSY immediately with no timeout set. busy_timeout makes it
// block-and-retry briefly instead (useful under Playwright's parallel
// workers). No-op against Postgres/pgvector, which has none of this.
if (!isPostgres()) {
  // Returns a result row (the new setting), which Prisma's $executeRaw
  // rejects ("Execute returned results") - $queryRaw tolerates that.
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
}
