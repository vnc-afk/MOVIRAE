import type { Message } from "@/lib/types";

export type MessageEvent = {
  type: "message-created" | "message-read";
  messageId?: string;
  conversationKey: string;
  fromId?: string;
  toId?: string;
  readerId?: string;
  message?: Message;
  timestamp: string;
};

type MessageEventListener = (event: MessageEvent) => void;
type MessageWebSocketBridge = (event: MessageEvent) => void;

const messageListeners = new Set<MessageEventListener>();

const messageWebSocketBridge = () =>
  (globalThis as typeof globalThis & {
    __messageWebSocketBroadcast?: MessageWebSocketBridge;
  }).__messageWebSocketBroadcast;

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
  messageWebSocketBridge()?.(payload);
}