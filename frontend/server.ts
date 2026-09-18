import { createServer, type IncomingMessage } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { WebSocketServer, type RawData } from "ws";

import { messageWebSocketHub } from "./lib/features/messages/websocket.ts";
import { getMessageWebSocketUserId } from "./lib/features/messages/websocket-auth.ts";

const dev = process.argv.includes("--dev");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

async function startServer() {
  (globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage }).AsyncLocalStorage ??= AsyncLocalStorage;
  const { default: next } = await import("next");
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const upgradeHandler = app.getUpgradeHandler();
  const server = createServer((request, response) => handle(request, response));
  const messageWebSocketServer = new WebSocketServer({ noServer: true });

  messageWebSocketServer.on("connection", (socket, userId: string) => {
    const connection = messageWebSocketHub.connect(userId, {
      send: (event) => socket.send(JSON.stringify(event)),
    });

    socket.on("message", (rawMessage: RawData) => {
      messageWebSocketHub.handleMessage(userId, rawMessage.toString());
    });
    socket.on("close", () => messageWebSocketHub.disconnect(userId, connection));
    socket.on("error", () => messageWebSocketHub.disconnect(userId, connection));
  });

  server.on("upgrade", async (request: IncomingMessage, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname !== "/api/messages/ws") {
      upgradeHandler(request, socket, head);
      return;
    }

    const userId = await getMessageWebSocketUserId(request);
    if (!userId) {
      socket.destroy();
      return;
    }

    messageWebSocketServer.handleUpgrade(request, socket, head, (client) => {
      messageWebSocketServer.emit("connection", client, userId);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on port ${port}`);
  });
}

void startServer();