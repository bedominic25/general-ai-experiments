import 'dotenv/config';
import { defineConfig } from '@playwright/test';

// Loads a local .env file if present (see .env.example) so ANTHROPIC_API_KEY
// doesn't need to be exported in every shell session. In CI, no .env file
// exists, so this is a silent no-op and the GitHub Actions secret is used
// instead -- see .github/workflows/eval.yml.

// This suite calls a live LLM API rather than driving a browser, so:
//  - `workers: 1` keeps calls sequential. This avoids provider rate limits and
//    keeps the aggregated evaluation report's ordering deterministic.
//  - There is no `use.browserName` — see src/providers/anthropic.ts, which uses
//    Playwright's request-context (API testing) feature, not a browser page.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    trace: 'retain-on-failure',
  },
});
