import client from "prom-client";

// Prometheus metrics exposed at GET /metrics (scraped by observability/prometheus.yml
// in the docker-compose topology, and by CloudWatch Container Insights / an ADOT
// sidecar in the ECS topology described in infra/terraform).
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "shopsphere_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const aiAssistantLatency = new client.Histogram({
  name: "shopsphere_ai_assistant_latency_seconds",
  help: "End-to-end latency of the RAG shopping-assistant pipeline (retrieval + LLM generation)",
  labelNames: ["llm_provider"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 4, 8, 16],
  registers: [registry],
});

export const aiAssistantErrors = new client.Counter({
  name: "shopsphere_ai_assistant_errors_total",
  help: "Failures from the LLM provider or retrieval step",
  labelNames: ["stage"] as const,
  registers: [registry],
});
