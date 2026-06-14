"use client";

import { Film, Clock, Star, Award, TrendingUp, MapPin } from "lucide-react";
import { StatCard } from "./StatCard";
import type { UserStats } from "@/lib/types";

interface StatsSummaryGridProps {
  userStats: UserStats;
}

export function StatsSummaryGrid({ userStats }: StatsSummaryGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <StatCard icon={Film} label="Films Watched" value={userStats.totalWatched.toString()} />
      <StatCard icon={Clock} label="Hours Watched" value={`${userStats.totalHours}h`} />
      <StatCard icon={Star} label="Avg Rating" value={userStats.avgRating.toFixed(1)} />
      <StatCard icon={Award} label="Fave Genre" value={userStats.favoriteGenre || "-"} />
      <StatCard icon={TrendingUp} label="Longest Streak" value={`${userStats.longestStreak}d`} />
      <StatCard icon={MapPin} label="Countries" value={userStats.countriesExplored.toString()} />
    </div>
  );
}
