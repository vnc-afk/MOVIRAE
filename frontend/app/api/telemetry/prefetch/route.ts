import { NextResponse } from "next/server";

type PrefetchTelemetryPayload = {
  attempts?: number;
  skipped?: number;
  succeeded?: number;
  failed?: number;
  cancelled?: number;
  hits?: number;
  misses?: number;
  lastUpdated?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PrefetchTelemetryPayload;

    if (process.env.NODE_ENV !== "production") {
      console.debug("/api/telemetry/prefetch", payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/telemetry/prefetch POST error:", error);
    return NextResponse.json({ ok: false, error: "Invalid telemetry payload" }, { status: 400 });
  }
}
