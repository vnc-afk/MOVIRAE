"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";

export type MessageSocketEvent = {
  type: "connected" | "message-created" | "message-read" | "typing-start" | "typing-stop";
  conversationKey?: string;
  messageId?: string;
  fromId?: string;
  toId?: string;
  readerId?: string;
  message?: Message;
  timestamp?: string;
};

type MessageSocketHandler = (event: MessageSocketEvent) => void | Promise<void>;

export function useMessageWebSocket(
  onEvent: MessageSocketHandler,
  options: { enabled?: boolean; userId?: string } = {}
) {
  const handlerRef = useRef(onEvent);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!(options.enabled ?? true)) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/messages/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt = 0;
      };

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as MessageSocketEvent;
          void handlerRef.current(event);
        } catch (error) {
          console.error("Failed to parse message WebSocket event:", error);
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (disposed) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000);
        reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [options.enabled]);

  return (recipientId: string, isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !options.userId) return;

    socket.send(JSON.stringify({
      type: isTyping ? "typing-start" : "typing-stop",
      fromId: options.userId,
      toId: recipientId,
    } satisfies MessageSocketEvent));
  };
}