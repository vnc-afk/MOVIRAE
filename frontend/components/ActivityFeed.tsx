"use client";

import { Eye, Heart, ListPlus, MessageCircle } from "lucide-react";
import { StarRating } from "./StarRating";
import { MoviePrefetchLink } from "./MoviePrefetchLink";
import type { ActivityItem } from "@/lib/types";

const actionIcons = {
  reviewed: MessageCircle,
  watched: Eye,
  added_to_watchlist: ListPlus,
  liked: Heart,
};

const actionText = {
  reviewed: "reviewed",
  watched: "watched",
  added_to_watchlist: "added to watchlist",
  liked: "liked",
};

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  function formatRelativeDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      const now = Date.now();
      const diff = Math.round((d.getTime() - now));

      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

      const seconds = Math.round(diff / 1000);
      const minutes = Math.round(diff / 60000);
      const hours = Math.round(diff / 3600000);
      const days = Math.round(diff / 86400000);
      const months = Math.round(diff / 2629800000);
      const years = Math.round(diff / 31557600000);

      if (Math.abs(seconds) < 45) return "just now";
      if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
      if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
      if (Math.abs(days) < 30) return rtf.format(days, "day");
      if (Math.abs(months) < 12) return rtf.format(months, "month");
      return rtf.format(years, "year");
    } catch (e) {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4 pb-6">
      {activities.map((item) => {
        const Icon = actionIcons[item.action];
        return (
          <div
            key={item.id}
            className="flex gap-3 rounded-lg bg-card p-4 card-shadow hover:card-shadow-hover transition-shadow duration-300"
          >
            {item.user.avatar ? (
              <img
                src={item.user.avatar}
                alt={item.user.displayName}
                className="h-9 w-9 rounded-full bg-muted flex-shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-foreground">
                  {item.user.displayName}
                </span>{" "}
                <span className="text-muted-foreground">
                  {actionText[item.action]}
                </span>{" "}
                <MoviePrefetchLink
                  movieId={item.movie.id}
                  href={`/movie/${item.movie.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {item.movie.title}
                </MoviePrefetchLink>
              </p>
              {item.rating && (
                <div className="mt-1">
                  <StarRating rating={item.rating} size="sm" />
                </div>
              )}
              {item.comment && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                  {item.comment}
                </p>
              )}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span>{formatRelativeDate(item.date)}</span>
              </div>
            </div>
            {item.movie.poster ? (
              <img
                src={item.movie.poster}
                alt={item.movie.title}
                className="h-16 w-11 rounded object-cover flex-shrink-0 poster-shadow"
              />
            ) : (
              <div className="h-16 w-11 rounded bg-muted flex-shrink-0 poster-shadow" />
            )}
          </div>
        );
      })}
    </div>
  );
}
