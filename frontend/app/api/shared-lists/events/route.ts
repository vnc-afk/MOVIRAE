import { subscribeToSharedListEvents } from "@/lib/shared-list-events";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; listId: string; action: string; timestamp: string }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const unsubscribe = subscribeToSharedListEvents(send);
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`));

      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      // handled via abort listener
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