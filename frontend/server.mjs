import { createServer } from "node:http";
import next from "next";
import { getToken } from "next-auth/jwt";
import { WebSocketServer } from "ws";

const dev = process.argv.includes("--dev");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const upgradeHandler = app.getUpgradeHandler();
const server = createServer((request, response) => handle(request, response));
const messageWebSocketServer = new WebSocketServer({ noServer: true });

globalThis.__messageWebSocketBroadcast = (event) => {
  const payload = JSON.stringify(event);
  const recipients = new Set([event.fromId, event.toId, event.readerId].filter(Boolean));

  for (const client of messageWebSocketServer.clients) {
    if (client.readyState === 1 && recipients.has(client.userId)) {
      client.send(payload);
    }
  }
};

messageWebSocketServer.on("connection", (socket, userId) => {
  socket.userId = userId;
  socket.on("message", (rawMessage) => {
    try {
      const event = JSON.parse(rawMessage.toString());
      if (
        (event.type !== "typing-start" && event.type !== "typing-stop") ||
        event.fromId !== userId ||
        typeof event.toId !== "string"
      ) {
        return;
      }

      const payload = JSON.stringify({
        type: event.type,
        fromId: userId,
        toId: event.toId,
        timestamp: new Date().toISOString(),
      });

      for (const client of messageWebSocketServer.clients) {
        if (client.readyState === 1 && client.userId === event.toId) {
          client.send(payload);
        }
      }
    } catch {
      // Ignore malformed client messages.
    }
  });
  socket.send(JSON.stringify({
    type: "connected",
    timestamp: new Date().toISOString(),
  }));
});

server.on("upgrade", async (request, socket, head) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/messages/ws") {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const userId = typeof token?.id === "string" ? token.id : null;

    if (!userId) {
      socket.destroy();
      return;
    }

    messageWebSocketServer.handleUpgrade(request, socket, head, (client) => {
      messageWebSocketServer.emit("connection", client, userId);
    });
    return;
  }

  upgradeHandler(request, socket, head);
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://localhost:${port}`);
});