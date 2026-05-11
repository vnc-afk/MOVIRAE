import { subscribeToGroupEvents } from "@/lib/group-events";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; groupId: string; timestamp: string }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const unsubscribe = subscribeToGroupEvents(groupId, send);
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ groupId, timestamp: new Date().toISOString() })}\n\n`));

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