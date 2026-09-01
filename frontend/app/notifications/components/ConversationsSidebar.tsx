"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageCircle } from "lucide-react";
import FriendsList from "@/components/FriendsList";
import ConversationListItem from "@/components/ConversationListItem";
import type { ConversationSummary } from "@/lib/features/messages/service";

interface ConversationsSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (userId: string) => void;
  onHoverConversation: (userId: string) => void;
}

/**
 * Sidebar showing conversation summaries and frequently messaged friends.
 *
 * This sidebar uses virtualization so large conversation lists do not
 * render all items at once.
 */
export default function ConversationsSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onHoverConversation,
}: ConversationsSidebarProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 3,
  });

  return (
    <aside className="rounded-xl bg-card card-shadow overflow-hidden border border-border lg:min-h-0 lg:h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <p className="font-semibold text-sm text-foreground">Conversations</p>
          <p className="text-[10px] text-muted-foreground">Direct messages</p>
        </div>
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="p-3 border-b border-border shrink-0">
        <p className="text-xs text-muted-foreground mb-2">Friends</p>
        <FriendsList onMessage={onSelectConversation} />
      </div>

      <div className="min-h-0 flex-1">
        <div ref={parentRef} className="min-h-0 overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const conversation = conversations[virtualRow.index];
              const isActive = conversation.partner.id === activeConversationId;
              return (
                <div
                  key={conversation.partner.id}
                  style={{ position: "absolute", top: virtualRow.start, left: 0, width: "100%" }}
                >
                  <ConversationListItem
                    conversation={conversation}
                    isActive={isActive}
                    onSelect={onSelectConversation}
                    onHover={onHoverConversation}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
