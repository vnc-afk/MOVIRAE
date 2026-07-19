"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type NotificationsTab = "notifications" | "messages";
export type MessageView = "list" | "thread";

interface UseNotificationsUrlStateResult {
  activeTab: NotificationsTab;
  selectedConversationUserId: string | null;
  mobileMessagesView: MessageView;
  setActiveTab: (tab: NotificationsTab) => void;
  selectConversation: (userId: string | null) => void;
}

/**
 * Manages the notifications page tab state and selected conversation URL state.
 *
 * This hook keeps the selected conversation in sync with the URL query string
 * while adjusting the mobile message view for list/thread navigation.
 */
export function useNotificationsUrlState(isMobile: boolean): UseNotificationsUrlStateResult {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversationUserId = searchParams?.get("user") ?? null;

  const [activeTab, setActiveTabState] = useState<NotificationsTab>(
    requestedConversationUserId ? "messages" : "notifications"
  );
  const [selectedConversationUserId, setSelectedConversationUserId] = useState<string | null>(
    requestedConversationUserId
  );
  const [mobileMessagesView, setMobileMessagesView] = useState<MessageView>(
    requestedConversationUserId && isMobile ? "thread" : "list"
  );

  const setActiveTab = useCallback(
    (tab: NotificationsTab) => {
      setActiveTabState(tab);
      if (tab !== "messages") {
        setMobileMessagesView("list");
      }
    },
    []
  );

  const selectConversation = useCallback(
    (userId: string | null) => {
      setSelectedConversationUserId(userId);
      if (userId) {
        setActiveTabState("messages");
        router.push(`${pathname}?user=${encodeURIComponent(userId)}`);
        if (isMobile) {
          setMobileMessagesView("thread");
        }
        return;
      }

      router.push(pathname);
      if (isMobile) {
        setMobileMessagesView("list");
      }
    },
    [isMobile, pathname, router]
  );

  useEffect(() => {
    if (!requestedConversationUserId) {
      if (selectedConversationUserId !== null) {
        setSelectedConversationUserId(null);
      }
      return;
    }

    if (requestedConversationUserId !== selectedConversationUserId) {
      setSelectedConversationUserId(requestedConversationUserId);
    }
  }, [requestedConversationUserId, selectedConversationUserId]);

  useEffect(() => {
    if (activeTab !== "messages") {
      setMobileMessagesView("list");
    }
  }, [activeTab]);

  return {
    activeTab,
    selectedConversationUserId,
    mobileMessagesView,
    setActiveTab,
    selectConversation,
  };
}
