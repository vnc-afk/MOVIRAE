import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { messageWebSocketHub } from "@/lib/features/messages/websocket";
import { getMessageWebSocketUserId } from "@/lib/features/messages/websocket-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const userId = await getMessageWebSocketUserId(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  return experimental_upgradeWebSocket((socket) => {
    const connection = messageWebSocketHub.connect(userId, {
      send: (event) => socket.send(JSON.stringify(event)),
    });

    socket.on("message", (rawMessage: WebSocketData) => {
      messageWebSocketHub.handleMessage(userId, rawMessage.toString());
    });
    socket.on("close", () => messageWebSocketHub.disconnect(userId, connection));
    socket.on("error", () => messageWebSocketHub.disconnect(userId, connection));
  });
}