import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/nextjs";

let sdk: NodeSDK | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.OTEL_SDK_DISABLED === "true" || !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  process.env.OTEL_SERVICE_NAME ??= "movirae";

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();

  const shutdown = async () => {
    await sdk?.shutdown();
  };

  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: Pick<NodeJS.Process, "once">;
    }
  ).process;

  nodeProcess?.once("SIGTERM", shutdown);
  nodeProcess?.once("SIGINT", shutdown);
}

export const onRequestError = Sentry.captureRequestError;