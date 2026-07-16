import { subscribeToGroupEvents } from "@/lib/group-events";
import type { GroupEvent } from "@/lib/group-events";

export const runtime = "nodejs";

/**
 * Opens a server-sent event stream for real-time group updates.
 */
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const enqueue = (chunk: string) => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      // Push each group event to the client as soon as it arrives.
      const send = (event: GroupEvent) => {
        enqueue(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = subscribeToGroupEvents(groupId, send);
      const heartbeatId = setInterval(() => {
        enqueue(": heartbeat\n\n");
      }, 30000);

      enqueue(
        `event: connected\ndata: ${JSON.stringify({
          groupId,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close, { once: true });
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
