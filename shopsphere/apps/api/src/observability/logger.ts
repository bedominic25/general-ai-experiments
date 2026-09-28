import pino from "pino";
import { env } from "../config/env.js";

// Structured JSON logs so they can be shipped to CloudWatch / any log
// aggregator without a translation layer - see observability/otel-collector-config.yaml
// for how these correlate with traces via trace_id/span_id injection.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "shopsphere-api" },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
