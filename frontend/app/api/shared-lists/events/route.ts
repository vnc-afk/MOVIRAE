import { subscribeToSharedListEvents } from "@/app/shared-lists/lib/events";
import type { SharedListEvent } from "@/app/shared-lists/lib/events";
import { getCurrentUser } from "@/app/shared-lists/lib/api-utils";
import { getSharedListForView } from "@/services/shared-lists/queries.server";

export const runtime = "nodejs";

/*
  Server-Sent Events endpoint for shared-list updates.
  - Streams `SharedListEvent` payloads to connected clients.
  - Filters events per-connection using `getSharedListForView` so clients only receive
    events for lists they are permitted to view.
  - Sends a heartbeat comment every 30s to keep connections alive through proxies.
  - Uses an in-process pub/sub (`subscribeToSharedListEvents`) to receive update notifications
    from API route handlers.
*/
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const currentUser = await getCurrentUser();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SharedListEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      // Guarded send: only forward events to this client if they are allowed to see them.
      const guardedSend = async (event: SharedListEvent) => {
        if (event.type === "deleted") {
          send(event);
          return;
        }

        if (!event.list) {
          send(event);
          return;
        }

        // Check if the current user would be able to view the updated list; prevents leaking.
        const visible = await getSharedListForView(event.list.id, currentUser);
        if (visible) {
          send(event);
        }
      };

      const unsubscribe = subscribeToSharedListEvents((event) => {
        void guardedSend(event);
      });

      // Inform the client that the connection is ready.
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
      );

      // Heartbeat helps keep the connection open across load balancers/proxies.
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