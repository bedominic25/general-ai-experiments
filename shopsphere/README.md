# ShopSphere

An AI-enabled shopping demo, and a Playwright/TypeScript test suite for it,
built to cover the same ground as testing a real e-commerce site end to end:
web + mobile-web UI (Page Object Model), REST and GraphQL APIs, a retrieval
database backing an LLM shopping assistant, authentication, performance,
cloud deployment, and observability/regression behavior. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how each piece is wired
and why.

## Quick start (no external services required)

```bash
npm install
npm run prisma:generate -w apps/api
cp .env.example apps/api/.env
cd apps/api && npx prisma migrate dev --name init && npm run seed && cd ../..

npm run dev:api   # http://localhost:4000  (REST + GraphQL at /graphql)
npm run dev:web   # http://localhost:5173  (in another terminal)
```

Log in with the seeded demo account (`demo@shopsphere.dev` /
`Password123!`) or register a new one. Try the "Ask the shopping assistant"
widget with something like *"I need something warm for winter trail
running"*.

By default `LLM_PROVIDER=mock`, so the assistant works with zero API keys.
Set `LLM_PROVIDER=claude` and `ANTHROPIC_API_KEY=...` in `apps/api/.env` for
real Claude-generated responses.

## Running the test suite

```bash
cd tests
npm install
npx playwright install chromium

npm run test          # everything (spins up api+web itself via webServer)
npm run test:web      # desktop-chrome + mobile-web UI specs only
npm run test:api      # REST
npm run test:graphql
npm run test:retrieval
npm run test:llm      # deterministic regression suite (mock provider)
npm run test:llm:live # opt-in: hits the real Claude API - needs ANTHROPIC_API_KEY
```

> **Note:** all specs run against dev-mode (`tsx`/`vite`) servers, not
> production builds. On a heavily loaded machine you may occasionally see a
> single `.click()`/`.fill()` time out under full parallelism (`fullyParallel:
> true`, 5+ workers) - it passes on retry (`--retries=1`, already the CI
> default) or with `--workers=2`. This is a dev-server-throughput artifact of
> the sandbox, not app behavior; every such failure reproduced here passed
> immediately when re-run in isolation.

Perf tests are separate (k6, not Playwright):

```bash
k6 run -e API_BASE_URL=http://localhost:4000 tests/perf/k6/product-search.js
k6 run -e API_BASE_URL=http://localhost:4000 tests/perf/k6/ai-assistant-flow.js
k6 run -e API_BASE_URL=http://localhost:4000 tests/perf/k6/checkout-flow.js
```

## Running the "production" topology locally

`docker-compose up --build` runs the same three services against real
Postgres+pgvector instead of SQLite (see `docker-compose.yml` and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#retrieval-database) for why
both exist).

## What's real vs. reference-only here

- **Real and runnable**: the API, the web app, the Playwright suite (60
  test cases across web/mobile-web/REST/GraphQL/retrieval/LLM-regression),
  the k6 scripts, docker-compose, CI.
- **Reference only, not applied**: `infra/terraform/*` describes the AWS
  deployment this would use (RDS+pgvector, ECS Fargate, S3+CloudFront,
  Secrets Manager, CloudWatch) - CI runs `terraform validate`, nobody runs
  `terraform apply`. See [`infra/README.md`](infra/README.md).

## Project structure

```
apps/api/    Express REST + Apollo GraphQL + Prisma + RAG assistant + JWT auth
apps/web/    React + Vite storefront with the AI chat widget
tests/       Playwright/TypeScript POM suite + k6 perf scripts
infra/       Terraform (reference)
observability/  otel-collector + Prometheus config for docker-compose.yml
docs/        Architecture notes
```
