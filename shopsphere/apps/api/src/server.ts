import "dotenv/config";
import { startTracing } from "./observability/tracing.js";

// Must run before any instrumented module is imported.
startTracing();

const { createApp } = await import("./app.js");
const { env } = await import("./config/env.js");
const { logger } = await import("./observability/logger.js");

const app = await createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, llmProvider: env.LLM_PROVIDER }, "shopsphere-api listening");
});
