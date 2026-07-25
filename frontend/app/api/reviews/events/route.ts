import { NextResponse } from "next/server";
import { subscribeToReviewEvents } from "@/lib/review-events";

export const runtime = "nodejs";

/**
 * Server-sent events endpoint for review lifecycle events.
 * Keeps the connection alive with regular heartbeats and cleans up
 * subscriptions when the client disconnects.
 */
export async function GET(_request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; movieId: string; reviewId: string; action: string; timestamp: string; opId?: string }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const unsubscribe = subscribeToReviewEvents(send as any);
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`));

      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      _request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
