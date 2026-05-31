"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bell, Heart, MessageCircle, UserPlus, Users, Sparkles, Check, MessageSquare, Send, UserCircle2, ChevronLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import useEventSource from "@/hooks/use-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  appendMessageToSnapshot,
  appendMessageToThread,
  appendNotificationToSnapshot,
  buildConversationSummaries,
  createOptimisticMessage,
  fetchMessageThread,
  fetchMessagingSnapshot,
  getCurrentUserFromSnapshot,
  makeTempMessageId,
  markAllNotificationsReadInSnapshot,
  markConversationMessagesReadInSnapshot,
  markConversationMessagesReadInThread,
  markNotificationReadInSnapshot,
  replaceMessageInSnapshot,
  replaceMessageInThread,
  type ConversationSummary,
  type MessageThreadSnapshot,
  type MessagingSnapshot,
} from "@/lib/messaging";
import type { Message, UserProfile } from "@/lib/types";
import type { NotificationItem as NotificationItemType } from "@/lib/types";
import { getNotificationLink } from "@/lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FriendsList from "@/components/FriendsList";
import NotificationItem from "@/components/NotificationItem";
import prefetchHelpers from "@/lib/prefetchHelpers";
import ConversationListItem from "@/components/ConversationListItem";

const typeIcons = {
  follow: UserPlus,
  review_like: Heart,
  review_reply: MessageCircle,
  discussion_created: MessageSquare,
  discussion_like: Heart,
  discussion_reply: MessageCircle,
  event_created: Sparkles,
  shared_list_like: Heart,
  shared_list_comment: MessageSquare,
  group_invite: Users,
  recommendation: Sparkles,
};

function formatRelativeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const distance = formatDistanceToNowStrict(parsed, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

function formatExactDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return format(parsed, "PPpp");
}

export default function Notifications() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("notifications");
  const [draftMessage, setDraftMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedConversationUserId, setSelectedConversationUserId] = useState<string | null>(null);
  const [mobileMessagesView, setMobileMessagesView] = useState<"list" | "thread">("list");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const _user = (session?.user as any) ?? {};
  const sessionIdOrEmail = _user.id ?? _user.email ?? null;
  const notificationsKey = useMemo(() => queryKeys.notifications.all(sessionIdOrEmail), [sessionIdOrEmail]);

  const PAGE_LIMIT = 50;

  const fetchNotificationsPage = async ({ pageParam = 0 }) => {
    const res = await fetch(`/api/data/user-notifications?limit=${PAGE_LIMIT}&offset=${pageParam}`);
    const json = await res.json().catch(() => null);
    return Array.isArray(json?.value) ? json.value : [];
  };

  const fetchMessagesPage = async ({ pageParam = 0 }) => {
    const res = await fetch(`/api/data/user-messages?limit=${PAGE_LIMIT}&offset=${pageParam}`);
    const json = await res.json().catch(() => null);
    return Array.isArray(json?.value) ? json.value : [];
  };

  const notificationsInfinite = useInfiniteQuery({
    queryKey: ["notifications", "paged", sessionIdOrEmail ?? "anonymous"],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => fetchNotificationsPage({ pageParam: pageParam as number }),
    getNextPageParam: (lastPage: any, pages: any[]) => {
      const fetched = pages.flat().length;
      return lastPage.length === PAGE_LIMIT ? fetched : undefined;
    },
    initialPageParam: 0,
  });

  const messagesInfinite = useInfiniteQuery({
    queryKey: ["messages", "paged", sessionIdOrEmail ?? "anonymous"],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => fetchMessagesPage({ pageParam: pageParam as number }),
    getNextPageParam: (lastPage: any, pages: any[]) => {
      const fetched = pages.flat().length;
      return lastPage.length === PAGE_LIMIT ? fetched : undefined;
    },
    initialPageParam: 0,
  });

  const usersQuery = usePrefetchAwareQuery<UserProfile[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users").then((r) => r.json()).catch(() => null);
      return Array.isArray(res?.value) ? res.value : [];
    },
    enabled: true,
  });

  const notificationPages = (notificationsInfinite.data as any)?.pages ?? [];
  const messagePages = (messagesInfinite.data as any)?.pages ?? [];

  const snapshot = {
    items: Array.isArray(notificationPages) ? notificationPages.flat() : [],
    messages: Array.isArray(messagePages) ? messagePages.flat() : [],
    users: usersQuery.data ?? [],
    sessionEmail: session?.user?.email ?? null,
  } as MessagingSnapshot;

  const items = snapshot.items;

  const notificationsParentRef = useRef<HTMLDivElement | null>(null);
  const notificationsVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => notificationsParentRef.current,
    estimateSize: () => 84,
    overscan: 5,
  });

  const conversationsParentRef = useRef<HTMLDivElement | null>(null);

  // Prefetch next notifications page when user scrolls near the bottom
  useEffect(() => {
    const el = notificationsParentRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
          const THRESHOLD = 400;
          if (remaining < THRESHOLD) {
            if ((notificationsInfinite as any).hasNextPage && !(notificationsInfinite as any).isFetchingNextPage) {
              void (notificationsInfinite as any).fetchNextPage();
            }
          }
        } finally {
          ticking = false;
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // initial check in case content is short
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [notificationsParentRef]);

  // Also prefetch when virtualizer renders items near the end
  useEffect(() => {
    const vitems = notificationsVirtualizer.getVirtualItems();
    if (!vitems.length) return;
    const last = vitems[vitems.length - 1];
    if (last.index >= items.length - 6) {
      if ((notificationsInfinite as any).hasNextPage && !(notificationsInfinite as any).isFetchingNextPage) {
        void (notificationsInfinite as any).fetchNextPage();
      }
    }
  }, [notificationsVirtualizer.getVirtualItems(), items.length]);

  // Prefetch next messages page when conversation list scrolls near bottom
  useEffect(() => {
    const el = conversationsParentRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
          const THRESHOLD = 300;
          if (remaining < THRESHOLD) {
            if ((messagesInfinite as any).hasNextPage && !(messagesInfinite as any).isFetchingNextPage) {
              void (messagesInfinite as any).fetchNextPage();
            }
          }
        } finally {
          ticking = false;
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [conversationsParentRef]);

  

  // Keep the legacy `notificationsKey` cache entry in sync for optimistic updates
  useEffect(() => {
    queryClient.setQueryData<MessagingSnapshot>(notificationsKey, snapshot);
  }, [snapshot, notificationsKey, queryClient]);
  const currentUser = getCurrentUserFromSnapshot(snapshot);
  const conversations = useMemo(() => buildConversationSummaries(snapshot, currentUser?.id ?? null), [snapshot, currentUser?.id]);

  // Initialize virtualizer for conversations after conversations is defined
  const conversationsVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => conversationsParentRef.current,
    estimateSize: () => 72,
    overscan: 3,
  });

  useEffect(() => {
    const vitems = conversationsVirtualizer.getVirtualItems();
    if (!vitems.length) return;
    const last = vitems[vitems.length - 1];
    if (last.index >= conversations.length - 6) {
      if ((messagesInfinite as any).hasNextPage && !(messagesInfinite as any).isFetchingNextPage) {
        void (messagesInfinite as any).fetchNextPage();
      }
    }
  }, [conversationsVirtualizer.getVirtualItems(), conversations.length]);
  const requestedConversationUserId = searchParams?.get("user") ?? null;
  const selectedUserId = selectedConversationUserId ?? requestedConversationUserId;
  const selectedPartner = selectedUserId ? snapshot.users.find((user) => user.id === selectedUserId) ?? null : null;
  const activeConversation: ConversationSummary | null =
    conversations.find((conversation) => conversation.partner.id === selectedUserId) ??
    (selectedPartner
      ? {
          partner: selectedPartner,
          messages: [],
          unreadCount: 0,
          lastMessageAt: "",
          conversationKey: currentUser ? [currentUser.id, selectedPartner.id].sort().join(":") : selectedPartner.id,
        }
      : null);
  const activeConversationPartnerId = activeConversation?.partner.id ?? null;
  const threadQueryKey = useMemo(
    () => queryKeys.messaging.thread(activeConversationPartnerId ?? "__idle__"),
    [activeConversationPartnerId]
  );
  const threadQuery = usePrefetchAwareQuery<MessageThreadSnapshot>({
    queryKey: threadQueryKey,
    queryFn: async () => fetchMessageThread(activeConversationPartnerId as string),
    enabled: activeTab === "messages" && Boolean(activeConversationPartnerId),
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const activeThread = threadQuery.data ?? {
    partner: activeConversation?.partner ?? null,
    messages: activeConversation?.messages ?? [],
    sessionEmail: snapshot.sessionEmail,
  };
  const unreadMessageCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  const scrollThreadToBottom = () => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  };

  useLayoutEffect(() => {
    if (activeTab !== "messages") return;

    // Run multiple times across frames so tab remount/layout changes can't reset to top.
    scrollThreadToBottom();
    const raf1 = requestAnimationFrame(() => {
      scrollThreadToBottom();
    });
    const raf2 = requestAnimationFrame(() => {
      scrollThreadToBottom();
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeConversation?.conversationKey, activeThread.messages.length, activeTab]);

  const handleNotificationClick = async (notification: NotificationItemType) => {
    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);

    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(notificationsKey, markNotificationReadInSnapshot(previousSnapshot, notification.id));
    }

    try {
      const link = getNotificationLink(notification);
      router.push(link);

      void fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" }).catch((error) => {
        console.error("Failed to mark notification read:", error);
        if (previousSnapshot) {
          queryClient.setQueryData(notificationsKey, previousSnapshot);
        }
      });
    } catch (error) {
      console.error("Failed to handle notification click:", error);
      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
      const link = getNotificationLink(notification);
      router.push(link);
    }
  };

  const setConversationAndUrl = (userId: string | null) => {
    setSelectedConversationUserId(userId);

    if (userId) {
      setActiveTab("messages");
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
  };

  useEffect(() => {
    if (!snapshot.users.length) {
      setSelectedConversationUserId(null);
      return;
    }

    if (requestedConversationUserId) {
      if (activeTab !== "messages") {
        setActiveTab("messages");
      }
    }

    if (!requestedConversationUserId) {
      if (selectedConversationUserId !== null) {
        setSelectedConversationUserId(null);
      }
      if (isMobile) {
        setMobileMessagesView("list");
      }
      return;
    }

    const requested = requestedConversationUserId;
    if (requested && snapshot.users.some((user) => user.id === requested)) {
      if (selectedConversationUserId !== requested) {
        setSelectedConversationUserId(requested);
      }
      if (isMobile) {
        setMobileMessagesView("thread");
      }
      return;
    }

    setSelectedConversationUserId(null);
  }, [activeTab, isMobile, requestedConversationUserId, selectedConversationUserId, snapshot.users]);

  useEffect(() => {
    if (activeTab !== "messages") {
      setMobileMessagesView("list");
    }
  }, [activeTab]);

  useEventSource(
    "/api/notifications/events",
    {
      "notification-created": (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data) as { recipientId?: string; notification?: NotificationItemType };

          if (currentUser && payload.recipientId && payload.notification && payload.recipientId === currentUser.id) {
            queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
              if (!current) return current;
              return appendNotificationToSnapshot(current, payload.notification as NotificationItemType);
            });
            return;
          }

          void notificationsInfinite.refetch();
        } catch (error) {
          console.error("Failed to update notifications:", error);
        }
      },
    },
    { enabled: true, onError: () => console.error("Notifications SSE error") }
  );

  useEventSource(
    "/api/messages/events",
    {
      "message-created": async () => {
          try {
          await notificationsInfinite.refetch();
          if (activeConversationPartnerId) {
            await threadQuery.refetch();
          }
        } catch (error) {
          console.error("Failed to update messages:", error);
        }
      },
      "message-read": async () => {
          try {
          await notificationsInfinite.refetch();
          if (activeConversationPartnerId) {
            await threadQuery.refetch();
          }
        } catch (error) {
          console.error("Failed to update messages:", error);
        }
      },
    },
    { enabled: true, onError: () => console.error("Messages SSE error") }
  );

  useEffect(() => {
    if (activeTab !== "messages" || !currentUser || !activeConversation || activeThread.messages.length === 0) return;

    const hasUnreadIncoming = activeThread.messages.some(
      (message) => message.fromId !== currentUser.id && !message.isRead
    );

    if (!hasUnreadIncoming) return;

    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
    const previousThread = activeConversationPartnerId ? queryClient.getQueryData<MessageThreadSnapshot>(threadQueryKey) : undefined;
    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(
        notificationsKey,
        markConversationMessagesReadInSnapshot(previousSnapshot, currentUser.id, activeConversation.partner.id)
      );
    }
    if (previousThread && activeConversationPartnerId) {
      queryClient.setQueryData<MessageThreadSnapshot>(
        threadQueryKey,
        markConversationMessagesReadInThread(previousThread, currentUser.id, activeConversation.partner.id)
      );
    }

    void fetch(`/api/messages/${activeConversation.partner.id}/read`, {
      method: "PATCH",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to mark conversation read");
      }
    }).catch((error) => {
      console.error("Failed to mark conversation read:", error);
      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
      if (previousThread && activeConversationPartnerId) {
        queryClient.setQueryData(threadQueryKey, previousThread);
      }
    });
  }, [activeConversation?.partner.id, activeThread.messages, currentUser, notificationsKey, queryClient, activeConversationPartnerId, threadQueryKey]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeConversation || !currentUser) return;

    const text = draftMessage.trim();
    if (!text) return;

    const tempId = makeTempMessageId();
    const optimisticMessage = createOptimisticMessage({
      id: tempId,
      from: currentUser,
      to: activeConversation.partner,
      text,
    });
    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
    const previousThread = queryClient.getQueryData<MessageThreadSnapshot>(threadQueryKey);

    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(notificationsKey, appendMessageToSnapshot(previousSnapshot, optimisticMessage));
    }
    if (previousThread) {
      queryClient.setQueryData<MessageThreadSnapshot>(threadQueryKey, appendMessageToThread(previousThread, optimisticMessage));
    }

    setDraftMessage("");
    setIsSendingMessage(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ toUserId: activeConversation.partner.id, text }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json().catch(() => null);
      const message = data?.value;

      if (message && previousSnapshot) {
        queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
          if (!current) return current;
          return replaceMessageInSnapshot(current, tempId, message);
        });
      }
      if (message && previousThread) {
        queryClient.setQueryData<MessageThreadSnapshot>(threadQueryKey, (current) => {
          if (!current) return current;
          return replaceMessageInThread(current, tempId, message);
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setDraftMessage(text);

      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
      if (previousThread) {
        queryClient.setQueryData(threadQueryKey, previousThread);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const unreadAlertCount = items.filter((n) => !n.read).length;

  const markAllRead = () => {
    const previousSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);

    if (previousSnapshot) {
      queryClient.setQueryData<MessagingSnapshot>(notificationsKey, markAllNotificationsReadInSnapshot(previousSnapshot));
    }

    void fetch("/api/notifications/read-all", {
      method: "PATCH",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }
    }).catch((error) => {
      console.error("Failed to mark all notifications read:", error);
      if (previousSnapshot) {
        queryClient.setQueryData(notificationsKey, previousSnapshot);
      }
    });
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 max-w-2xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold text-foreground">
                Notifications
              </h1>
            </div>
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Check className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm">
              <Bell className="h-3.5 w-3.5" /> Alerts
              {unreadAlertCount > 0 && (
                <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadAlertCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 text-xs sm:text-sm">
              <MessageCircle className="h-3.5 w-3.5" /> Messages
              {unreadMessageCount > 0 && (
                <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadMessageCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
              <div className="space-y-2">
                <div ref={notificationsParentRef} className="min-h-0 max-h-[60vh] overflow-y-auto">
                  <div style={{ height: notificationsVirtualizer.getTotalSize(), position: "relative" }}>
                    {notificationsVirtualizer.getVirtualItems().map((virtualRow) => {
                      const notif = items[virtualRow.index];
                      return (
                        <div key={notif.id} style={{ position: "absolute", top: virtualRow.start, left: 0, width: "100%" }}>
                          <NotificationItem
                            notif={notif}
                            index={virtualRow.index}
                            onClick={handleNotificationClick}
                            onHover={(n: NotificationItemType) => {
                              // Prefetch likely useful targets depending on notification type
                              try {
                                if (n.user?.id) {
                                  void queryClient.prefetchQuery({
                                    queryKey: queryKeys.profile.detail(n.user.id),
                                    queryFn: async () => {
                                      const res = await fetch(`/api/users/${n.user.id}`);
                                      const json = await res.json().catch(() => null);
                                      return json?.value ?? json;
                                    },
                                  });
                                }

                                if (n.movieId) {
                                  void prefetchHelpers.scheduleMovieDetailPrefetch(queryClient, n.movieId, `notif-movie-${n.movieId}`);
                                }

                                if (n.sharedListId) {
                                  void queryClient.prefetchQuery({
                                    queryKey: queryKeys.sharedLists.detail(n.sharedListId),
                                    queryFn: async () => {
                                      const res = await fetch(`/api/shared-lists/${n.sharedListId}`);
                                      const json = await res.json().catch(() => null);
                                      return json?.value ?? json;
                                    },
                                  });
                                }

                                if (n.groupId) {
                                  void queryClient.prefetchQuery({
                                    queryKey: queryKeys.group.detail(n.groupId),
                                    queryFn: async () => {
                                      const res = await fetch(`/api/groups/${n.groupId}`);
                                      const json = await res.json().catch(() => null);
                                      return json?.value ?? json;
                                    },
                                  });
                                }
                              } catch (e) {
                                // best-effort
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
          </TabsContent>

          <TabsContent value="messages" className="min-h-0">
            <div className="grid gap-4 min-h-0 h-[70dvh] lg:grid-cols-[280px_minmax(0,1fr)] lg:h-[min(72dvh,760px)]">
              {(!isMobile || mobileMessagesView === "list") && (
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
                  <FriendsList
                    onMessage={(friendId) => {
                      setConversationAndUrl(friendId);
                    }}
                  />
                </div>

                <div className="min-h-0 flex-1">
                  <div ref={conversationsParentRef} className="min-h-0 overflow-y-auto">
                    <div style={{ height: conversationsVirtualizer.getTotalSize(), position: "relative" }}>
                      {conversationsVirtualizer.getVirtualItems().map((v) => {
                        const conversation = conversations[v.index];
                        const isActive = conversation.partner.id === activeConversation?.partner.id;
                        return (
                          <div key={conversation.partner.id} style={{ position: "absolute", top: v.start, left: 0, width: "100%" }}>
                            <ConversationListItem
                              conversation={conversation}
                              isActive={isActive}
                              onSelect={(id) => {
                                setConversationAndUrl(id);
                              }}
                              onHover={(id) => {
                                const key = queryKeys.messaging.thread(id);
                                void queryClient.prefetchQuery({ queryKey: key, queryFn: () => fetchMessageThread(id) });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                </aside>
              )}

              {(!isMobile || mobileMessagesView === "thread") && (
                <div className="rounded-xl bg-card card-shadow overflow-hidden border border-border flex min-h-0 flex-col lg:h-full">
                  {activeConversation ? (
                  <>
                    <div className="flex items-center gap-3 border-b border-border p-4 shrink-0">
                      {isMobile && (
                        <button
                          type="button"
                          onClick={() => {
                            setConversationAndUrl(null);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground md:hidden"
                          aria-label="Back to conversations"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      )}
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

                    <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                      {activeThread.messages.map((message) => {
                        const isMe = currentUser ? message.fromId === currentUser.id : false;

                        return (
                          <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
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
                    </div>

                    <form onSubmit={handleSendMessage} className="border-t border-border p-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={draftMessage}
                          onChange={(e) => setDraftMessage(e.target.value)}
                          placeholder={`Message ${activeConversation.partner.displayName}`}
                          className="flex-1 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        <button
                          type="submit"
                          disabled={isSendingMessage}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className={`h-4 w-4 ${isSendingMessage ? "animate-pulse" : ""}`} />
                        </button>
                      </div>
                    </form>
                  </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">No conversation selected</p>
                        <p className="text-sm text-muted-foreground">
                          Pick a conversation to read and reply.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
