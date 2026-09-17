"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import type { AssistantMessage } from "../lib/types";

const welcome: AssistantMessage = {
  id: "welcome",
  role: "assistant",
  text: "Tell me what you want to watch and I will find a strong match.",
};

export function useAssistantConversation(query: string, movies: Movie[], isLoading: boolean, loadedQuery: string) {
  const [messages, setMessages] = useState<AssistantMessage[]>([welcome]);
  const [error, setError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);
  const lastHandledQuery = useRef("");

  useEffect(() => {
    if (!query || lastHandledQuery.current === query || isLoading || loadedQuery !== query) return;
    lastHandledQuery.current = query;
    setMessages((current) => [...current, {
      id: `assistant-${query}`,
      role: "assistant",
      text: `Here are recommendations for “${query}”:`,
      movies,
    }]);
  }, [isLoading, loadedQuery, movies, query]);

  useEffect(() => {
    if (!query || isLoading || loadedQuery !== query) return;
    setMessages((current) => {
      const last = current[current.length - 1];
      if (last?.role !== "assistant" || last.id !== `assistant-${query}`) return current;
      return [...current.slice(0, -1), { ...last, movies }];
    });
  }, [isLoading, loadedQuery, movies, query]);

  const addUserMessage = useCallback(async (text: string) => {
    const history = messages
      .filter((message) => message.id !== "welcome")
      .map((message) => ({ role: message.role, content: message.text }));
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text }]);
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to generate an AI response";
        throw new Error(message);
      }

      const assistantText = typeof payload === "object" && payload !== null && "response" in payload && typeof payload.response === "string"
        ? payload.response.trim()
        : "";
      if (!assistantText) throw new Error("The AI returned an empty response");
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: assistantText }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to generate an AI response"));
    } finally {
      setIsSending(false);
    }
  }, [messages]);

  return { messages, addUserMessage, error, isSending };
}