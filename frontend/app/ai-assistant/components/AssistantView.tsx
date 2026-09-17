"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { ASSISTANT_SUGGESTIONS } from "../lib/constants";
import { useAssistantConversation } from "../hooks/useAssistantConversation";
import { useAssistantUrl } from "../hooks/useAssistantUrl";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessageList } from "./AssistantMessageList";

export function AssistantView() {
  const { query, setQuery } = useAssistantUrl();
  const conversation = useAssistantConversation();
  const [input, setInput] = useState(query);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.messages, conversation.isSending]);

  const send = (value: string) => {
    const normalized = value.trim();
    if (!normalized || conversation.isSending) return;
    void conversation.addUserMessage(normalized);
    setInput("");
    setQuery(normalized);
  };

  return <main className="pb-20 md:pb-0"><div className="container mx-auto flex max-w-3xl flex-col py-8" style={{ height: "calc(100vh - 5rem)" }}>
    <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><h1 className="font-display text-2xl font-bold text-foreground">Movie Assistant</h1></div><p className="mt-1 text-sm text-muted-foreground">Describe a mood, genre, or film you loved.</p></motion.header>
    <AssistantMessageList ref={scrollRef} messages={conversation.messages} isLoading={conversation.isSending} error={conversation.error} hasMore={false} isFetchingMore={false} onLoadMore={() => undefined} />
    {!query ? <div className="mb-3 flex flex-wrap gap-2">{ASSISTANT_SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5">{suggestion}</button>)}</div> : null}
    <AssistantComposer value={input} onChange={setInput} onSubmit={send} disabled={conversation.isSending} />
  </div></main>;
}