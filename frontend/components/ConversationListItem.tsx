"use client";

import { memo } from "react";
import { UserCircle2 } from "lucide-react";
import type { ConversationSummary } from "@/services/messages/messages.client";

type Props = {
  conversation: ConversationSummary;
  isActive?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string) => void;
};

function ConversationListItem({ conversation, isActive = false, onSelect, onHover }: Props) {
  const previewMessage = conversation.messages[conversation.messages.length - 1];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(conversation.partner.id)}
      onMouseEnter={() => onHover?.(conversation.partner.id)}
      className={`flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors last:border-b-0 ${
        isActive
          ? "bg-primary/10"
          : conversation.unreadCount > 0
            ? "bg-primary/5 hover:bg-primary/10"
            : "hover:bg-secondary/60"
      }`}
    >
      {conversation.partner.avatar ? (
        <img
          src={conversation.partner.avatar}
          alt={conversation.partner.displayName}
          className="h-10 w-10 rounded-full bg-muted flex-shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <UserCircle2 className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${conversation.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/85"}`}>
            {conversation.partner.displayName}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="h-5 min-w-5 rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className={`truncate text-xs ${conversation.unreadCount > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
          {previewMessage?.text || "No messages yet"}
        </p>
      </div>
    </button>
  );
}

function areEqual(prev: Props, next: Props) {
  return (
    prev.conversation.partner.id === next.conversation.partner.id &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.messages.length === next.conversation.messages.length &&
    prev.isActive === next.isActive
  );
}

export default memo(ConversationListItem, areEqual);
