import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { Message } from "@/lib/types";

export type MessageSocketEvent = {
  type: "connected" | "message-created" | "message-read" | "typing-start" | "typing-stop";
  conversationKey?: string;
  messageId?: string;
  fromId?: string;
  toId?: string;
  readerId?: string;
  message?: Message;
  timestamp: string;
};

export type MessageSocketConnection = {
  send: (event: MessageSocketEvent) => void;
};

type RedisEnvelope = {
  sourceId: string;
  event: MessageSocketEvent;
};

const REDIS_CHANNEL = process.env.MESSAGE_WEBSOCKET_REDIS_CHANNEL ?? "movirae:messages:websocket";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTypingEvent(value: unknown): value is { type: "typing-start" | "typing-stop"; fromId: string; toId: string } {
  return (
    isRecord(value) &&
    (value.type === "typing-start" || value.type === "typing-stop") &&
    typeof value.fromId === "string" &&
    typeof value.toId === "string"
  );
}

export class MessageWebSocketHub {
  private readonly connectionsByUser = new Map<string, Set<MessageSocketConnection>>();
  private readonly sourceId = randomUUID();
  private readonly redisPublisher: Redis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.redisPublisher = null;
      return;
    }

    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2_500,
      family: 4,
      retryStrategy: (attempts: number) => Math.min(attempts * 1_000, 10_000),
    };
    const publisher = new Redis(redisUrl, redisOptions);
    const subscriber = publisher.duplicate();
    let redisWarningShown = false;
    const reportRedisError = (error: Error) => {
      if (!redisWarningShown) {
        redisWarningShown = true;
        console.warn("Message WebSocket Redis unavailable; retrying in the background:", error.message);
      }
    };

    publisher.on("error", reportRedisError);
    subscriber.on("error", reportRedisError);
    subscriber.on("ready", () => {
      void subscriber.subscribe(REDIS_CHANNEL).catch(reportRedisError);
    });
    subscriber.on("message", (_channel, rawEnvelope) => {
      try {
        const envelope = JSON.parse(rawEnvelope) as RedisEnvelope;
        if (envelope.sourceId !== this.sourceId && envelope.event) {
          this.broadcastLocal(envelope.event);
        }
      } catch {
        // Ignore malformed broker messages.
      }
    });

    this.redisPublisher = publisher;
  }

  connect(userId: string, connection: MessageSocketConnection) {
    const userConnections = this.connectionsByUser.get(userId) ?? new Set<MessageSocketConnection>();
    userConnections.add(connection);
    this.connectionsByUser.set(userId, userConnections);
    connection.send({ type: "connected", timestamp: new Date().toISOString() });
    return connection;
  }

  disconnect(userId: string, connection: MessageSocketConnection) {
    const userConnections = this.connectionsByUser.get(userId);
    if (!userConnections) return;
    userConnections.delete(connection);
    if (userConnections.size === 0) this.connectionsByUser.delete(userId);
  }

  handleMessage(userId: string, rawMessage: string) {
    try {
      const event: unknown = JSON.parse(rawMessage);
      if (!isTypingEvent(event) || event.fromId !== userId) return;

      this.broadcast({
        type: event.type,
        fromId: userId,
        toId: event.toId,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore malformed client messages.
    }
  }

  broadcast(event: MessageSocketEvent) {
    this.broadcastLocal(event);
    if (this.redisPublisher) {
      const envelope: RedisEnvelope = { sourceId: this.sourceId, event };
      void this.redisPublisher.publish(REDIS_CHANNEL, JSON.stringify(envelope)).catch((error: unknown) => {
        console.warn("Message WebSocket Redis publish failed:", error);
      });
    }
  }

  private broadcastLocal(event: MessageSocketEvent) {
    const recipients = new Set([event.fromId, event.toId, event.readerId].filter((id): id is string => Boolean(id)));
    for (const userId of recipients) {
      for (const connection of this.connectionsByUser.get(userId) ?? []) {
        try {
          connection.send(event);
        } catch {
          // The adapter owns socket cleanup; a failed send must not stop other recipients.
        }
      }
    }
  }
}

export const messageWebSocketHub = new MessageWebSocketHub();