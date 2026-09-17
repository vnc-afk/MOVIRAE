"use client";

import { forwardRef, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MovieCard } from "@/components/MovieCard";
import { Sparkles, User } from "lucide-react";
import type { AssistantMessage } from "../lib/types";

function AssistantText({ text }: { text: string }) {
  const lines = text
    .replace(/\s+(?=\d+\.\s+\*\*)/g, "\n")
    .replace(/\s+-\s+(?=\*\*)/g, "\n")
    .split(/\r?\n/)
    .filter(Boolean);

  return <div className="space-y-1.5">{lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return <div key={`${lineIndex}-${line}`}>
      {parts.map((part, partIndex) => part.startsWith("**") && part.endsWith("**")
        ? <strong key={`${partIndex}-${part}`}>{part.slice(2, -2)}</strong>
        : <span key={`${partIndex}-${part}`}>{part.replace(/^\*\s+/, "")}</span>)}
    </div>;
  })}</div>;
}

interface AssistantMessageListProps {
  messages: AssistantMessage[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}

export const AssistantMessageList = memo(forwardRef<HTMLDivElement, AssistantMessageListProps>(function AssistantMessageList({ messages, isLoading, error, hasMore, isFetchingMore, onLoadMore }, ref) {
  return <div ref={ref} className="mb-4 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin"><AnimatePresence initial={false}>{messages.map((message) => <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}><div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "order-last bg-primary" : "bg-primary/10"}`}>{message.role === "user" ? <User className="h-4 w-4 text-primary-foreground" /> : <Sparkles className="h-4 w-4 text-primary" />}</div><div className={`max-w-[88%] space-y-3 ${message.role === "user" ? "order-first" : ""}`}><div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-foreground"}`}><AssistantText text={message.text} /></div>{message.movies?.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{message.movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} disableEntranceAnimation />)}</div> : null}</div></motion.div>)}</AnimatePresence>{isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> Finding your next watch...</div> : null}{error ? <p className="text-sm text-destructive">{error.message}</p> : null}{hasMore ? <button type="button" onClick={onLoadMore} disabled={isFetchingMore} className="text-sm font-medium text-primary hover:underline">{isFetchingMore ? "Loading..." : "Load more recommendations"}</button> : null}</div>;
}));

AssistantMessageList.displayName = "AssistantMessageList";