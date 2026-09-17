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

  const addUserMessage = useCallback((text: string) => {
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text }]);
  }, []);

  return { messages, addUserMessage };
}