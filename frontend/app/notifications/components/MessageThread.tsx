"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, MessageCircle, Send } from "lucide-react";
import type { ConversationSummary, MessageThreadSnapshot } from "@/lib/features/messages/service";
import type { UserProfile } from "@/lib/types";
import { formatExactDate, formatRelativeDate } from "../lib/utils";
import NoConversationSelected from "./NoConversationSelected";

interface MessageThreadProps {
  activeConversation: ConversationSummary | null;
  activeThread: MessageThreadSnapshot;
  currentUser: UserProfile | null;
  onBack?: () => void;
  onSendMessage: (text: string) => Promise<void>;
  isPartnerTyping: boolean;
  onTypingChange: (isTyping: boolean) => void;
  isMobile: boolean;
}

/**
 * Renders the active message thread and input form for the selected conversation.
 *
 * The component auto-scrolls to the latest message and preserves the draft state.
 */
export default function MessageThread({
  activeConversation,
  activeThread,
  currentUser,
  onBack,
  onSendMessage,
  isPartnerTyping,
  onTypingChange,
  isMobile,
}: MessageThreadProps) {
  const [draftMessage, setDraftMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollContainer = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(
    () => activeThread.messages ?? [],
    [activeThread.messages]
  );

  const scrollToBottom = () => {
    const container = scrollContainer.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  useLayoutEffect(() => {
    // Scroll to the latest message when the conversation changes or a new
    // message is appended, using multiple RAF calls to handle layout timing.
    scrollToBottom();
    const raf1 = requestAnimationFrame(scrollToBottom);
    const raf2 = requestAnimationFrame(scrollToBottom);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeConversation?.conversationKey, messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending || !draftMessage.trim()) return;

    setIsSending(true);
    onTypingChange(false);
    await onSendMessage(draftMessage);
    setDraftMessage("");
    setIsSending(false);
  };

  return (
    <div className="rounded-xl bg-card card-shadow overflow-hidden border border-border flex min-h-0 flex-col lg:h-full">
      {activeConversation ? (
        <>
          <div className="flex items-center gap-3 border-b border-border p-4 shrink-0">
            {isMobile && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground md:hidden"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            {activeConversation.partner.avatar ? (
              <img
                src={activeConversation.partner.avatar}
                alt={activeConversation.partner.displayName}
                className="h-10 w-10 rounded-full bg-muted"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted" />
            )}
            <div>
              <p className="font-semibold text-sm text-foreground">
                {activeConversation.partner.displayName}
              </p>
              <p className="text-[10px] text-accent">
                {activeConversation.unreadCount > 0 ? "Unread messages" : "Up to date"}
              </p>
            </div>
          </div>

          <div
            ref={scrollContainer}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.map((message) => {
              const isMe = currentUser ? message.fromId === currentUser.id : false;

              return (
                <div
                  key={message.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`w-fit max-w-[78%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                      isMe
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    <div
                      className={`mt-1 flex items-center justify-between gap-3 text-[10px] ${
                        isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                      }`}
                      title={formatExactDate(message.date)}
                    >
                      <span>{formatRelativeDate(message.date)}</span>
                      {isMe && <span>{message.isRead ? "Read" : "Sent"}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {isPartnerTyping ? (
              <p className="text-xs text-muted-foreground">{activeConversation.partner.displayName} is typing...</p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraftMessage(value);
                  onTypingChange(Boolean(value.trim()));
                }}
                placeholder={`Message ${activeConversation.partner.displayName}`}
                className="flex-1 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={isSending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className={`h-4 w-4 ${isSending ? "animate-pulse" : ""}`} />
              </button>
            </div>
          </form>
        </>
      ) : (
          <NoConversationSelected />
      )}
    </div>
  );
}
