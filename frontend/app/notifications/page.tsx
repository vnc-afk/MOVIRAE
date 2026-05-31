"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bell, Heart, MessageCircle, UserPlus, Users, Sparkles, Check, MessageSquare, Send, UserCircle2, ChevronLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
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
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import { getNotificationLink } from "@/lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FriendsList from "@/components/FriendsList";

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
  const sessionEmail = session?.user?.email ?? null;
  const notificationsKey = useMemo(() => queryKeys.notifications.all(sessionEmail), [sessionEmail]);

  const notificationsQuery = usePrefetchAwareQuery<MessagingSnapshot>({
    queryKey: notificationsKey,
    queryFn: fetchMessagingSnapshot,
    enabled: true,
  });

  const snapshot = notificationsQuery.data ?? { items: [], messages: [], users: [], sessionEmail: null };
  const items = snapshot.items;
  const currentUser = getCurrentUserFromSnapshot(snapshot);
  const conversations = useMemo(() => buildConversationSummaries(snapshot, currentUser?.id ?? null), [snapshot, currentUser?.id]);
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
      : conversations[0] ?? null);
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

  const handleNotificationClick = async (notification: NotificationItem) => {
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

  useEffect(() => {
    if (!snapshot.users.length) {
      setSelectedConversationUserId(null);
      return;
    }

    if (requestedConversationUserId) {
      setActiveTab("messages");
    }

    const selectedConversationExists = selectedConversationUserId
      ? conversations.some((conversation) => conversation.partner.id === selectedConversationUserId)
      : false;

    if (selectedConversationExists) {
      return;
    }

    const requested = searchParams?.get("user");
    if (requested && snapshot.users.some((user) => user.id === requested)) {
      setSelectedConversationUserId(requested);
      if (isMobile) {
        setMobileMessagesView("thread");
      }
      return;
    }

    if (conversations.length > 0) {
      setSelectedConversationUserId(conversations[0].partner.id);
      return;
    }

    setSelectedConversationUserId(null);
  }, [conversations, searchParams, selectedConversationUserId, snapshot.users]);

  useEffect(() => {
    if (activeTab !== "messages") {
      setMobileMessagesView("list");
    }
  }, [activeTab]);

  useEffect(() => {
    const eventSource = new EventSource("/api/notifications/events");

    eventSource.addEventListener("notification-created", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          recipientId?: string;
          notification?: NotificationItem;
        };

        if (currentUser && payload.recipientId && payload.notification && payload.recipientId === currentUser.id) {
          queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
            if (!current) return current;
            return appendNotificationToSnapshot(current, payload.notification as NotificationItem);
          });
          return;
        }

        void notificationsQuery.refetch();
      } catch (error) {
        console.error("Failed to update notifications:", error);
      }
    });

    eventSource.addEventListener("error", () => {
      console.error("SSE connection error");
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [currentUser?.id, notificationsKey, notificationsQuery.refetch, queryClient]);

  useEffect(() => {
    const eventSource = new EventSource("/api/messages/events");

    const refreshMessages = async () => {
      try {
        await notificationsQuery.refetch();
        if (activeConversationPartnerId) {
          await threadQuery.refetch();
        }
      } catch (error) {
        console.error("Failed to update messages:", error);
      }
    };

    eventSource.addEventListener("message-created", refreshMessages);
    eventSource.addEventListener("message-read", refreshMessages);

    eventSource.addEventListener("error", () => {
      console.error("Message SSE connection error");
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [activeConversationPartnerId, notificationsQuery.refetch, threadQuery.refetch]);

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
              {items.map((notif, i) => {
                const Icon = typeIcons[notif.type] || Bell;
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 rounded-lg p-4 transition-colors cursor-pointer hover:opacity-80 ${
                      notif.read ? "bg-card" : "bg-primary/5 border border-primary/10"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notif.read ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">
                          {notif.user.displayName}
                        </span>{" "}
                        <span className="text-muted-foreground">{notif.message}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1" title={formatExactDate(notif.date)}>
                        {formatRelativeDate(notif.date)}
                      </p>
                    </div>
                    {notif.user.avatar ? (
                      <img
                        src={notif.user.avatar}
                        alt={notif.user.displayName}
                        className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                    )}
                  </motion.div>
                );
              })}
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
                      setActiveTab("messages");
                      setSelectedConversationUserId(friendId);
                      if (isMobile) {
                        setMobileMessagesView("thread");
                      }
                    }}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {conversations.length > 0 ? (
                    conversations.map((conversation) => {
                      const isActive = conversation.partner.id === activeConversation?.partner.id;
                      const previewMessage = conversation.messages[conversation.messages.length - 1];

                      return (
                        <button
                          key={conversation.partner.id}
                          type="button"
                          onClick={() => {
                            setSelectedConversationUserId(conversation.partner.id);
                            if (isMobile) {
                              setMobileMessagesView("thread");
                            }
                          }}
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
                    })
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No direct messages yet.
                    </div>
                  )}
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
                            setMobileMessagesView("list");
                            router.replace("/notifications");
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
