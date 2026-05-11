"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, UserPlus, Users, Sparkles, Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const typeIcons = {
  like: Heart,
  reply: MessageCircle,
  follow: UserPlus,
  group_invite: Users,
  recommendation: Sparkles,
};

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/data/user-notifications").then((response) => response.json()),
      fetch("/api/data/user-messages").then((response) => response.json()),
      fetch("/api/users").then((response) => response.json()),
    ])
      .then(([notificationsResponse, messagesResponse, usersResponse]) => {
        setItems(Array.isArray(notificationsResponse.value) ? notificationsResponse.value : []);
        setMessages(Array.isArray(messagesResponse.value) ? messagesResponse.value : []);
        setUsers(Array.isArray(usersResponse.value) ? usersResponse.value : []);
      })
      .catch((error) => console.error("Failed to load notifications:", error));
  }, []);

  const markAllRead = () => setItems(items.map((n) => ({ ...n, read: true })));

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
                const Icon = typeIcons[notif.type];
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-3 rounded-lg p-4 transition-colors ${
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
                      <p className="text-xs text-muted-foreground mt-1">{notif.date}</p>
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
                        >
                          {msg.date}
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
