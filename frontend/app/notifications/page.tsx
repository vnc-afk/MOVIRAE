"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryKeys } from "@/lib/queryKeys";
import { buildConversationSummaries, getCurrentUserFromSnapshot, fetchMessageThread } from "@/lib/features/messages/service";
import { getNotificationLink } from "@/app/notifications/lib/links";
import NotificationsHeader from "./components/NotificationsHeader";
import NotificationFeed from "./components/NotificationFeed";
import ConversationsSidebar from "./components/ConversationsSidebar";
import MessageThread from "./components/MessageThread";
import {
  useConversationThread,
  useNotificationsData,
  useNotificationsRealtime,
  useNotificationsUrlState,
  useNotificationActions,
} from "./hooks";

/**
 * Notifications dashboard page for alerts and direct messages.
 *
 * This component orchestrates notifications data, real-time updates,
 * and message thread selection so the UI can render both the alerts feed
 * and the messaging experience in a mobile-friendly layout.
 */
export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const identity = (session?.user as any) ?? {};
  const sessionIdOrEmail = identity.id ?? identity.email ?? null;
  const sessionEmail = identity.email ?? null;

  const {
    activeTab,
    selectedConversationUserId,
    mobileMessagesView,
    setActiveTab,
    selectConversation,
  } = useNotificationsUrlState(isMobile);

  const {
    snapshot,
    notificationsHasMore,
    messagesHasMore,
    fetchNextNotifications,
    fetchNextMessages,
    refetchNotifications,
    refetchMessages,
    notificationsKey,
  } = useNotificationsData(sessionIdOrEmail, sessionEmail);

  const currentUser = useMemo(
    () => getCurrentUserFromSnapshot(snapshot),
    [snapshot]
  );

  const conversations = useMemo(
    () => buildConversationSummaries(snapshot, currentUser?.id ?? null),
    [snapshot, currentUser?.id]
  );

  const selectedPartner = selectedConversationUserId
    ? snapshot.users.find((user) => user.id === selectedConversationUserId) ?? null
    : null;

  const activeConversation = useMemo(() => {
    const existing = conversations.find(
      (conversation) => conversation.partner.id === selectedConversationUserId
    );

    if (existing) {
      return existing;
    }

    if (selectedPartner && currentUser) {
      // Create a placeholder conversation when the partner is selected but
      // there is not yet an existing thread in the cached conversation list.
      return {
        partner: selectedPartner,
        messages: [],
        unreadCount: 0,
        lastMessageAt: "",
        conversationKey: [currentUser.id, selectedPartner.id].sort().join(":"),
      };
    }

    return null;
  }, [conversations, selectedConversationUserId, selectedPartner, currentUser]);

  const activeConversationPartnerId = activeConversation?.partner.id ?? null;

  const {
    activeThread,
    threadQueryKey,
  } = useConversationThread(activeConversationPartnerId, activeTab === "messages");

  const { markNotificationRead, markAllRead, sendMessage } = useNotificationActions({
    activeConversation,
    activeConversationPartnerId,
    activeThread,
    activeTab,
    currentUser,
    notificationsKey,
    threadQueryKey,
  });

  const { isPartnerTyping, sendTyping } = useNotificationsRealtime({
    currentUser,
    notificationsKey,
    activeConversationPartnerId,
    threadQueryKey,
    refetchNotifications,
  });

  const unreadAlertCount = snapshot.items.filter((notification) => !notification.read).length;
  const unreadMessageCount = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );

  const handleNotificationClick = async (notification: any) => {
    await markNotificationRead(notification);
    const link = getNotificationLink(notification);
    router.push(link);
  };

  const handlePrefetchNotification = (_notification: any) => {
    // This callback is intentionally empty because the UI component handles prefetching.
  };

  const handleHoverConversation = async (userId: string) => {
    const key = queryKeys.messaging.thread(userId);
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => fetchMessageThread(userId),
    });
  };

  return (
    <div className="pb-20 md:pb-0 overflow-x-hidden">
      <div className="container py-8 max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <NotificationsHeader
            activeTab={activeTab}
            unreadAlertCount={unreadAlertCount}
            unreadMessageCount={unreadMessageCount}
            onTabChange={setActiveTab}
            onMarkAllRead={markAllRead}
          />
        </motion.div>

        {activeTab === "notifications" ? (
          <NotificationFeed
            notifications={snapshot.items}
            onNotificationClick={handleNotificationClick}
            onPrefetchNotification={handlePrefetchNotification}
            loadMore={fetchNextNotifications}
            hasMore={notificationsHasMore}
          />
        ) : (
          <div className="grid gap-4 min-h-0 h-[70dvh] lg:grid-cols-[280px_minmax(0,1fr)] lg:h-[min(72dvh,760px)]">
            {(!isMobile || mobileMessagesView === "list") && (
              <ConversationsSidebar
                conversations={conversations}
                activeConversationId={activeConversation?.partner.id ?? null}
                onSelectConversation={selectConversation}
                onHoverConversation={handleHoverConversation}
              />
            )}

            {(!isMobile || mobileMessagesView === "thread") && (
              <MessageThread
                activeConversation={activeConversation}
                activeThread={activeThread}
                currentUser={currentUser}
                isMobile={isMobile}
                onBack={() => selectConversation(null)}
                onSendMessage={sendMessage}
                isPartnerTyping={isPartnerTyping}
                onTypingChange={(isTyping) => {
                  if (activeConversationPartnerId) {
                    sendTyping(activeConversationPartnerId, isTyping);
                  }
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
