"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  UserPlus,
  Heart,
  MessageCircle,
  MessagesSquare,
  CalendarPlus,
  Share2,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem as NotificationItemType } from "@/lib/types";
import { formatDistanceToNowStrict, format } from "date-fns";

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

const NOTIFICATION_ICONS: Record<NotificationItemType["type"], LucideIcon> = {
  follow: UserPlus,
  review_like: Heart,
  review_reply: MessageCircle,
  discussion_created: MessagesSquare,
  discussion_like: Heart,
  discussion_reply: MessageCircle,
  event_created: CalendarPlus,
  shared_list_like: Heart,
  shared_list_comment: MessageCircle,
  group_invite: Users,
  recommendation: Sparkles,
};

type Props = {
  notif: NotificationItemType;
  index?: number;
  onClick?: (n: NotificationItemType) => void;
  onHover?: (n: NotificationItemType) => void;
};

function NotificationItem({ notif, index = 0, onClick, onHover }: Props) {
  const Icon = NOTIFICATION_ICONS[notif.type] ?? Bell;

  const actorName = notif.user?.displayName ?? "Someone";
  const actorAvatar = notif.user?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onClick?.(notif)}
      onMouseEnter={() => onHover?.(notif)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(notif);
        }
      }}
      className={`flex w-full items-start gap-3 rounded-lg p-4 transition-colors cursor-pointer hover:opacity-80 ${
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
          <span className="font-semibold text-foreground">{actorName}</span>{" "}
          <span className="text-muted-foreground">{notif.message}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1" title={formatExactDate(notif.date)}>
          {formatRelativeDate(notif.date)}
        </p>
      </div>
      {actorAvatar ? (
        <img src={actorAvatar} alt={actorName} className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
      )}
    </motion.div>
  );
}

function areEqual(prev: Props, next: Props) {
  const a = prev.notif;
  const b = next.notif;
  return (
    a.id === b.id &&
    a.read === b.read &&
    a.message === b.message &&
    a.type === b.type &&
    a.user?.avatar === b.user?.avatar &&
    a.user?.displayName === b.user?.displayName
  );
}

export default memo(NotificationItem, areEqual);