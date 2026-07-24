import { getCurrentUser } from "@/app/notifications/lib/api-utils";
import { subscribeToNotifications } from "@/app/notifications/lib/events";
import type { NotificationEvent } from "@/app/notifications/lib/events";

export const runtime = "nodejs";

/**
 * Server-Sent Events endpoint for notification updates.
 *
 * Only events destined for the authenticated recipient are forwarded.
 * A heartbeat comment keeps the connection alive through proxies.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const currentUser = await getCurrentUser();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const enqueue = (chunk: string) => {
        if (!isClosed) controller.enqueue(encoder.encode(chunk));
      };

      const send = (event: NotificationEvent) => {
        if (!currentUser) return;

        if (event.recipientId) {
          if (event.recipientId !== currentUser.id) return;
        } else {
          console.warn("notification-created event published with no recipientId — update its publish call site to include one", event);
        }

        enqueue(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = subscribeToNotifications(send);
      enqueue(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

      const heartbeatId = setInterval(() => enqueue(`: heartbeat\n\n`), 30000);

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close, { once: true });
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