import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { subscribeToNotificationEvents } from "@/lib/features/notifications/events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!currentUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let subscriber: Awaited<ReturnType<typeof subscribeToNotificationEvents>> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      subscriber = await subscribeToNotificationEvents((event) => {
        if (event.recipientId === currentUser.id) send(event.type, event);
      });

      send("connected", { timestamp: new Date().toISOString() });
      const heartbeatId = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatId);
        void subscriber?.quit();
        controller.close();
      });
    },
    cancel() {
      void subscriber?.quit();
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