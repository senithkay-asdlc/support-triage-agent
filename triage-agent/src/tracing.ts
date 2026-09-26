// tracing.ts — imported for side effects from the top of main.ts, before
// anything creates a model client. Inert unless AMP_OTEL_ENDPOINT and
// AMP_AGENT_API_KEY are both set; never fail startup over tracing.

import { trace } from "@opentelemetry/api";
import { NodeTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { config } from "./config.js";

export const tracer = trace.getTracer("agent");

if (config.otelEndpoint && config.ampAgentApiKey) {
  const provider = new NodeTracerProvider({
    // SET THIS OR THE TRACES ARE ANONYMOUS. A provider built without a
    // resource reports `service.name: unknown_service:node`, and every agent
    // in the org looks identical in the trace view.
    resource: new Resource({
      "service.name": config.otelServiceName,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          // The exporter appends nothing — AMP_OTEL_ENDPOINT is a base.
          url: `${config.otelEndpoint}/v1/traces`,
          headers: { "x-amp-api-key": config.ampAgentApiKey },
        }),
      ),
    ],
  });
  provider.register();
  // Without this the last spans of a turn die with the pod.
  process.on("SIGTERM", () => {
    void provider.shutdown().finally(() => process.exit(0));
  });
}
