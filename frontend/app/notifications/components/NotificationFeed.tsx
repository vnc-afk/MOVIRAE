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

/**
 * A virtualized notification feed that loads more alerts as the user scrolls.
 *
 * Virtualization keeps the DOM small for long notification lists, and
 * prefetches related notification targets on hover.
 */
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
  const virtualItems = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  useEffect(() => {
    if (lastVisibleIndex >= notifications.length - 6 && hasMore) {
      // Load the next page before the user reaches the end of the list.
      loadMore();
    }
  }, [lastVisibleIndex, notifications.length, hasMore, loadMore]);

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div ref={parentRef} className="min-h-0 max-h-[60vh] overflow-y-auto overflow-x-hidden">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualItems.map((virtualRow) => {
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