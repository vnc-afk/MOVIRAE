import { messageWebSocketHub, type MessageSocketEvent as MessageEvent } from "@/lib/features/messages/websocket";

export type { MessageEvent };

type MessageEventListener = (event: MessageEvent) => void;
const messageListeners = new Set<MessageEventListener>();

export function subscribeToMessageEvents(listener: MessageEventListener) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

export function publishMessageEvent(event: Omit<MessageEvent, "timestamp">) {
  const payload: MessageEvent = { ...event, timestamp: new Date().toISOString() };
  for (const listener of messageListeners) {
    listener(payload);
  }
  messageWebSocketHub.broadcast(payload);
}