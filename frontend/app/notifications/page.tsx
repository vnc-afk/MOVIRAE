"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bell, Heart, MessageCircle, UserPlus, Users, Sparkles, Check, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import { getNotificationLink } from "@/lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type NotificationsSnapshot = {
  items: NotificationItem[];
  messages: Message[];
  users: UserProfile[];
};

export default function Notifications() {
  const router = useRouter();
  const [messageText, setMessageText] = useState("");
  const queryClient = useQueryClient();

  const notificationsQuery = usePrefetchAwareQuery<NotificationsSnapshot>({
    queryKey: queryKeys.notifications.all(),
    queryFn: async () => {
      const [notificationsResponse, messagesResponse, usersResponse] = await Promise.all([
        fetch("/api/data/user-notifications").then((response) => response.json()),
        fetch("/api/data/user-messages").then((response) => response.json()),
        fetch("/api/users").then((response) => response.json()),
      ]);

      return {
        items: Array.isArray(notificationsResponse.value) ? notificationsResponse.value : [],
        messages: Array.isArray(messagesResponse.value) ? messagesResponse.value : [],
        users: Array.isArray(usersResponse.value) ? usersResponse.value : [],
      };
    },
    enabled: true,
  });

  const snapshot = notificationsQuery.data ?? { items: [], messages: [], users: [] };
  const items = snapshot.items;
  const messages = snapshot.messages;
  const users = snapshot.users;

  const handleNotificationClick = async (notification: NotificationItem) => {
    try {
      // Mark as read
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });

      // Navigate to the notification context
      const link = getNotificationLink(notification);
      router.push(link);

      applyEntityUpdate(queryClient, [queryKeys.notifications.all()], (current: NotificationsSnapshot | undefined) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        };
      });
    } catch (error) {
      console.error("Failed to handle notification click:", error);
      // Still navigate even if marking as read fails
      const link = getNotificationLink(notification);
      router.push(link);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource("/api/notifications/events");

    eventSource.addEventListener("notification-created", async () => {
      try {
        await notificationsQuery.refetch();
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
  }, [notificationsQuery]);

  const markAllRead = () => {
    applyEntityUpdate(queryClient, [queryKeys.notifications.all()], (current: NotificationsSnapshot | undefined) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((n) => ({ ...n, read: true })),
      };
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

        <Tabs defaultValue="notifications">
          <TabsList className="bg-secondary mb-6">
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Alerts
              {items.filter((n) => !n.read).length > 0 && (
                <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {items.filter((n) => !n.read).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Messages
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
                    <img
                      src={notif.user.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
                    />
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <div className="rounded-xl bg-card card-shadow overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 p-4 border-b border-border">
                {users[1] ? (
                  <img
                    src={users[1].avatar}
                    alt={users[1].displayName}
                    className="h-9 w-9 rounded-full bg-muted"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted" />
                )}
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {users[1]?.displayName || "Messages"}
                  </p>
                  <p className="text-[10px] text-accent">Online</p>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                {messages.map((msg) => {
                  const isMe = users[0] ? msg.from.id === users[0].id : false;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                          }`}
                          title={formatExactDate(msg.date)}
                        >
                          {formatRelativeDate(msg.date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                />
                <button className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity">
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
