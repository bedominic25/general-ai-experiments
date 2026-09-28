import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { env } from "../config/env.js";

// Distributed tracing: spans an incoming request through Express -> Prisma ->
// (retrieval) -> Anthropic call, exported over OTLP/HTTP to the collector
// defined in observability/otel-collector-config.yaml. Must be imported and
// started before any instrumented module (express/http/prisma) is required,
// which is why server.ts imports this file first.
let sdk: NodeSDK | undefined;

export function startTracing(): void {
  if (sdk || !env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  sdk = new NodeSDK({
    serviceName: "shopsphere-api",
    traceExporter: new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function stopTracing(): Promise<void> {
  await sdk?.shutdown();
}
