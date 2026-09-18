import { createServer, type IncomingMessage } from "node:http";
import next from "next";
import { WebSocketServer, type RawData } from "ws";

import { getMessageWebSocketUserId } from "@/lib/features/messages/websocket-auth";
import { messageWebSocketHub } from "@/lib/features/messages/websocket";

const dev = process.argv.includes("--dev");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
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