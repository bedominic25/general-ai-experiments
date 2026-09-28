import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_BASE_URL, WEB_BASE_URL } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "../apps/api");
const webDir = path.resolve(__dirname, "../apps/web");

const apiEnv = {
  DATABASE_URL: "file:./test.db",
  LLM_PROVIDER: "mock",
  PORT: "4000",
  NODE_ENV: "test",
};

export default defineConfig({
  testDir: "specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  // Generous for a monorepo running dev-mode Vite/tsx servers under full
  // parallelism on a shared/CI machine - see README's flake note.
  timeout: 45_000,

  webServer: [
    {
      // Reset + migrate + seed a dedicated SQLite test database, THEN start
      // the server - all as one shell chain, so the server's first Prisma
      // connection can never race a separate "reset the db" step run in
      // parallel (that race intermittently pointed the already-running
      // server at a since-deleted/re-created db file and every query then
      // failed with "table does not exist"). reuseExistingServer is off here
      // on purpose, unlike the web server below: this reset must run fresh
      // every invocation, and it's cheap.
      command:
        "rm -f prisma/test.db prisma/test.db-wal prisma/test.db-shm && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx src/server.ts",
      cwd: apiDir,
      env: apiEnv,
      url: `${API_BASE_URL}/health`,
      reuseExistingServer: false,
      timeout: 45_000,
    },
    {
      command: "npx vite --port 5173",
      cwd: webDir,
      env: { VITE_API_BASE_URL: API_BASE_URL, VITE_GRAPHQL_URL: `${API_BASE_URL}/graphql` },
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],

  projects: [
    {
      name: "desktop-chrome",
      testDir: "specs/web",
      use: { ...devices["Desktop Chrome"], baseURL: WEB_BASE_URL },
    },
    {
      // Mobile-web: Playwright's device emulation drives the same responsive
      // storefront through a real mobile viewport/UA (Chromium-based, so no
      // extra browser binary beyond Desktop Chrome above), mirroring how the
      // Amazon-style brief asks for the mobile-web (not native app) surface.
      name: "mobile-web",
      testDir: "specs/web",
      use: { ...devices["Pixel 7"], baseURL: WEB_BASE_URL },
    },
    {
      name: "api",
      testDir: "specs/api/rest",
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "graphql",
      testDir: "specs/api/graphql",
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "retrieval",
      testDir: "specs/retrieval",
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "llm-regression",
      testDir: "specs/llm",
      testMatch: /regression\.spec\.ts/,
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "llm-live",
      testDir: "specs/llm",
      testMatch: /live\.spec\.ts/,
      use: { baseURL: API_BASE_URL },
    },
  ],
});
