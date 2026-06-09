"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import NotificationItem from "@/components/NotificationItem";
import { prefetchNotificationTargets } from "../lib/utils";
import type { NotificationItem as NotificationItemType } from "@/lib/types";

interface NotificationFeedProps {
  notifications: NotificationItemType[];
  onNotificationClick: (notification: NotificationItemType) => void;
  onPrefetchNotification: (notification: NotificationItemType) => void;
  loadMore: () => void;
  hasMore: boolean;
}

export default function NotificationFeed({
  notifications,
  onNotificationClick,
  onPrefetchNotification,
  loadMore,
  hasMore,
}: NotificationFeedProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const virtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 5,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
          if (remaining < 400 && hasMore) {
            loadMore();
          }
        } finally {
          ticking = false;
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadMore]);

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    if (!items.length) return;
    const last = items[items.length - 1];
    if (last.index >= notifications.length - 6 && hasMore) {
      loadMore();
    }
  }, [virtualizer.getVirtualItems(), notifications.length, hasMore, loadMore]);

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div
        ref={parentRef}
        className="min-h-0 max-h-[60vh] overflow-y-auto overflow-x-hidden"
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const notification = notifications[virtualRow.index];
            return (
              <div
                key={notification.id}
                style={{ position: "absolute", top: virtualRow.start, left: 0, width: "100%" }}
              >
                <NotificationItem
                  notif={notification}
                  index={virtualRow.index}
                  onClick={onNotificationClick}
                  onHover={(item) => {
                    onPrefetchNotification(item);
                    void prefetchNotificationTargets(queryClient, item);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
