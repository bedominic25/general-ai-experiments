# ShopSphere architecture

An AI-enabled shopping demo built to exercise the same discipline as testing
a real storefront (POM/Playwright/TypeScript, REST + GraphQL, a retrieval
database, LLM responses, auth, performance, cloud deployment, observability
and regression) without needing Amazon's actual site - a scoped-down,
fully-owned equivalent instead.

## Monorepo layout

```
shopsphere/
  apps/api/     Express + Prisma + Apollo (REST /api/*, GraphQL /graphql)
  apps/web/     React + Vite storefront (product grid, cart, checkout, AI chat widget)
  tests/        Playwright + TypeScript: POM, REST, GraphQL, retrieval, LLM regression, k6 perf
  infra/        Terraform (reference only - see infra/README.md)
  observability/  otel-collector + Prometheus config used by docker-compose.yml
```

## Retrieval database

`src/ai/vectorizer.ts` embeds text with a dependency-free hashed
bag-of-words/bigrams vector (feature hashing, 256 dims, L2-normalized) - no
external embeddings API or key required, deterministic, and good enough to
separate this catalog's categories/attributes. `src/ai/vectorStore.ts`
exposes a `VectorStore` interface with two implementations selected at
runtime by `DATABASE_URL`:

- `SqliteVectorStore` (default, local/CI): loads embeddings from the
  relational table and ranks with an in-process cosine similarity. This is
  what every test in `tests/specs/retrieval` and `tests/specs/llm` runs
  against.
- `PgVectorStore` (production): real ANN search via the `pgvector` extension
  and an `ivfflat` index, added by `apps/api/prisma/pgvector-extension.sql`
  on top of the Prisma-managed schema (Prisma has no native `vector` column
  type, so that one migration lives outside `schema.prisma`).

Swapping the embedding function for a real embeddings API later touches only
`vectorizer.ts` - nothing downstream changes.

## LLM responses

`src/ai/llmProvider.ts` defines an `LlmProvider` interface with:

- `ClaudeProvider` - real generation via `@anthropic-ai/sdk`, grounded on
  *our own* retrieval step (the model is told "answer using ONLY these
  candidates," not asked to recall products from training data).
- `MockLlmProvider` - a deterministic function of the retrieved products,
  used by default in tests/CI (`LLM_PROVIDER=mock`) so the regression suite
  never depends on network access, API cost, or model non-determinism.

`src/ai/assistant.ts` wires retrieval -> history -> generation -> persistence
(every turn is logged to `ChatMessage`, which doubles as the observability/
regression trail) and records latency + error-stage metrics.

## Authentication

JWT-based (`src/auth/`), bcrypt password hashes, `requireAuth`/`optionalAuth`
Express middleware, and the same token validated in GraphQL's context
function (`src/graphql/server.ts`). The AI chat endpoint accepts anonymous
sessions on purpose (a guest can ask the assistant questions before creating
an account), everything cart/order-related requires a token.

## Performance

`tests/perf/k6/*.js` - three k6 scripts: read-path browsing/search,
the AI-assistant RAG pipeline (the most latency-sensitive endpoint, gets a
looser p95 threshold to account for LLM generation time), and a write-path
register/cart/checkout flow. `.github/workflows/shopsphere.yml`'s (at the repo root) `k6-smoke` job runs
a short version of the first one on every push as a regression tripwire.

## Cloud deployment

`infra/terraform/*.tf` is a complete reference topology (VPC, RDS
Postgres+pgvector, ECS Fargate + ALB, S3+CloudFront, Secrets Manager,
CloudWatch dashboards/alarms) mirroring `docker-compose.yml`'s local
services 1:1 - see the table in `infra/README.md`. Per the current scope
decision, CI only runs `terraform fmt`/`validate`; nobody applies it.

## Observability and regression behavior

- Structured JSON logs (`pino`) and Prometheus metrics (`prom-client`,
  scraped at `/metrics`) - `shopsphere_ai_assistant_latency_seconds` and
  `shopsphere_ai_assistant_errors_total` specifically track the AI pipeline.
- OpenTelemetry tracing (`src/observability/tracing.ts`) exports spans over
  OTLP/HTTP to the collector in `observability/otel-collector-config.yaml`.
- Regression behavior: `tests/specs/llm/regression.spec.ts` pins golden
  expected recommendations per query against the deterministic mock
  provider - the same pattern as this monorepo's sibling
  `../llm-eval-framework` project, adapted to pin the retrieval+generation
  contract rather than a bare LLM call. `tests/specs/retrieval` pins the
  ranking behavior of the retrieval database itself, independent of the LLM.
- `tests/specs/llm/live.spec.ts` is the opt-in real-Claude counterpart
  (`LIVE_LLM_TESTS=true` + a real `ANTHROPIC_API_KEY`), asserting the
  softer "mentions a retrieved product" contract that's appropriate for a
  non-deterministic model, rather than exact-string golden output.

## Testing surfaces (POM/Playwright/TypeScript)

`tests/pom/` follows the Page Object Model: page classes under `pages/`,
reusable widgets (navbar, the AI chat panel) under `components/`, both
exposing `data-testid`-scoped locators and action methods, never raw
selectors leaking into spec files. `tests/playwright.config.ts` defines
projects for `desktop-chrome`, `mobile-web` (Chromium's Pixel 7 device
emulation - the mobile-*web* surface, not a native app, matching the
Amazon-style "web and mobile-web" brief), `api`, `graphql`, `retrieval`,
`llm-regression`, and `llm-live`.
