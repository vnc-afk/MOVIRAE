"use client";

import Link from "next/link";
import { Eye, Heart, ListPlus, MessageCircle } from "lucide-react";
import { StarRating } from "./StarRating";
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
  return (
    <div className="space-y-4">
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
                <Link
                  href={`/movie/${item.movie.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {item.movie.title}
                </Link>
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
                <span>{item.date}</span>
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
