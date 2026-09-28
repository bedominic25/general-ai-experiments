# LLM Evaluation Framework

A TypeScript + Playwright framework for evaluating LLM API responses: structured-output
validation, relevance scoring, latency/cost tracking, and prompt-injection / unsafe-output
detection. Runs locally or in GitHub Actions and produces an HTML + JSON evaluation report.

## Why this exists

Most of my QA/automation background is web and mobile UI testing. This project exists
specifically to close a gap: I use AI tools (Claude, Copilot, ChatGPT) daily as a developer,
but that's a different skill from *testing an LLM as the system under test*. This is a
small, real, working demonstration of the latter — not a toy, not a tutorial copy-paste.
I built every file in this repo myself, understand every design decision below, and can
walk through any part of it.

## Architecture

```
src/
  providers/       LLM client abstraction (Anthropic implementation included)
  scoring/         schema validation, relevance scoring, safety heuristics
  report/          aggregates results into JSON + self-contained HTML
test-cases/        the actual prompts and pass/fail criteria being evaluated
tests/             the Playwright test file that wires it all together
```

### Why Playwright's request-context, not a browser

Playwright has two distinct capabilities: browser automation (pages, clicks, screenshots)
and API testing, via `request.newContext()` — a plain HTTP client with the same test
runner, fixtures, and reporting. This project uses only the latter. There is no
`page.goto()` anywhere in this repo, and CI never runs `playwright install` — a genuine,
deliberate choice, not an oversight: calling an LLM API is fundamentally an HTTP request/
response cycle, and using a browser to drive a chat UI just to send prompts would add
flakiness (rendering, selectors, rate-limited UIs) for no benefit when the API is available
directly. I still get Playwright's test runner, parallelism controls, retries, tracing, and
HTML reporting for free.

### What each evaluation dimension actually measures, and its limits

- **Structured-response validation** (`src/scoring/schema.ts`): parses the model's output
  as JSON (unwrapping a ` ```json ` fence if the model added one despite being told not to)
  and validates it against a [Zod](https://zod.dev) schema per test case. This is a hard
  pass/fail — either the shape is right or it isn't.

- **Relevance** (`src/scoring/relevance.ts`): the default mode is a deterministic
  keyword-overlap check — does the response contain the terms a correct answer should
  contain? This is cheap, fast, and fully explainable, but shallow: it can't distinguish
  "the answer is Paris" from "this is not Paris, but here's a paragraph that happens to
  mention Paris." The file also includes `llmJudgeRelevance()`, which asks the *same model*
  to self-rate relevance 1-5 — a real, widely-used pattern in LLM evals, but one that costs
  an extra API call per case and has its own accuracy limits. It's implemented but **not**
  wired into the default test run, specifically to keep CI fast and cheap — see "Extending
  this" below for how to turn it on.

- **Latency & cost** (`src/providers/anthropic.ts`): latency is wall-clock time around the
  API call. Cost is `tokens used × a hardcoded price-per-token table`. That table will go
  stale — provider pricing changes — so it's explicitly commented as illustrative, not
  something to quote as current pricing without checking the provider's site first.

- **Prompt-injection & unsafe-output detection** (`src/scoring/safety.ts`): a short list of
  regex patterns for obvious cases ("ignore previous instructions," "developer mode," etc.).
  I want to be direct about this rather than oversell it: **this is a heuristic, not a
  production-grade classifier.** Real injection attempts are far more varied — encoding
  tricks, indirection through retrieved documents, multi-turn setups — than any fixed
  pattern list covers. A production system would pair this fast first-pass filter with a
  dedicated moderation/classifier model. The value here is demonstrating the *pattern*
  (test-time input/output screening, logged and reported) not claiming comprehensive
  coverage.

## Running it

```bash
npm install
cp .env.example .env          # then paste your own key into .env (already gitignored)
npm test                      # runs the suite, prints pass/fail per case
npm run test:report           # opens Playwright's own HTML report
```

`.env` is loaded automatically via `dotenv/config` in `playwright.config.ts`. If you'd
rather not use a file at all, exporting the variable directly also works:
`export ANTHROPIC_API_KEY=sk-ant-...`. Either way, use a key from its own scoped Anthropic
Console workspace (see "Extending this" below) rather than a shared/personal key.

After a run, open `reports/evaluation-report.html` for the custom aggregated report
(pass/fail, latency, cost, relevance, schema validity, and safety flags per case, plus
summary totals) — this is separate from Playwright's own HTML report and is the
"evaluation report" this framework is specifically built to produce.

## CI

`.github/workflows/llm-eval-framework.yml` (at the repo root) runs the full suite on every push to
`main` and every pull request that touches this project, using an `ANTHROPIC_API_KEY` repository
secret, and uploads both reports as a downloadable artifact. Because there's real API cost per run (see the cost tracking above —
this framework literally measures its own CI spend), this is deliberately not run on every
commit to every branch, only `main` and PRs.

## Extending this

- **Turn on LLM-as-judge relevance**: import `llmJudgeRelevance` in `tests/eval.spec.ts`
  and call it alongside `keywordRelevance`, gated behind an env var (e.g.
  `if (process.env.LLM_JUDGE === 'true')`) so it stays opt-in given the added cost.
- **Add a second provider**: implement the `LLMProvider` interface
  (`src/providers/types.ts`) for OpenAI or another vendor — the scoring and reporting
  layers are provider-agnostic by design.
- **Swap the safety heuristics for a real moderation API**: replace the regex checks in
  `src/scoring/safety.ts` with a call to a dedicated moderation endpoint, keeping the same
  `SafetyCheckResult` shape so nothing else in the pipeline needs to change.
- **Scope the API key, don't just protect it**: this project uses its own Anthropic
  Console workspace and a key created specifically for it (`llm-eval-framework-*`), with a
  spend limit set on the workspace, rather than reusing a personal/work key. A leaked or
  misused key then has a capped blast radius instead of access to a broader account. If you
  add a second provider (above), give it the same treatment — a dedicated, scoped key per
  provider, not one shared key reused everywhere.
- **Federated auth, if this ever calls a cloud-hosted model**: Anthropic's own API only
  supports API-key auth, so that's what this project uses. If this were extended to call a
  model through a cloud provider instead (e.g. Amazon Bedrock or Google Vertex AI), the
  better modern practice would be GitHub Actions OIDC → a short-lived, federated cloud role,
  rather than a long-lived cloud credential sitting in a repo secret.
