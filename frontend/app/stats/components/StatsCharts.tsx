"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Calendar, TrendingUp, Sparkles, Monitor, Users, Star } from "lucide-react";
import type { UserStats } from "@/lib/types";

const COLORS = [
  "hsl(36, 90%, 50%)",
  "hsl(150, 50%, 40%)",
  "hsl(220, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(45, 80%, 50%)",
  "hsl(180, 50%, 45%)",
  "hsl(330, 60%, 50%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const MOODS: Array<string> = [
  "Thrilling",
  "Relaxing",
  "Romantic",
  "Dark",
  "Uplifting",
  "Thought-Provoking",
  "Fun",
  "Intense",
];

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-");
  const yearNumber = Number(year);
  const monthNumber = Number(month);

  if (!Number.isInteger(yearNumber) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return monthValue;
  }

  return new Date(Date.UTC(yearNumber, monthNumber - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
  });
}

interface StatsChartsProps {
  userStats: UserStats;
}

export function StatsCharts({ userStats }: StatsChartsProps) {
  const monthlyChartData = useMemo(
    () =>
      [...userStats.monthlyBreakdown]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((entry) => ({ ...entry, monthLabel: formatMonthLabel(entry.month) })),
    [userStats.monthlyBreakdown]
  );

  const moodCountMap = useMemo(
    () => new Map(userStats.moodBreakdown.map((entry) => [entry.mood, entry.count])),
    [userStats.moodBreakdown]
  );

  const moodChartData = useMemo(
    () =>
      MOODS.map((mood) => ({
        mood,
        value: moodCountMap.get(mood) ?? 0,
      })),
    [moodCountMap]
  );

  const maxPlatformCount = Math.max(0, ...userStats.platformBreakdown.map((entry) => entry.count));
  const maxContextCount = Math.max(0, ...userStats.contextBreakdown.map((entry) => entry.count));
  const maxRatingCount = Math.max(0, ...userStats.ratingDistribution.map((entry) => entry.count));

  return (
    <>
      <div className="rounded-xl bg-card p-6 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Films Per Month</h2>
        </div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData}>
              <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(36, 90%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Genre Breakdown</h2>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userStats.genreBreakdown}
                  dataKey="count"
                  nameKey="genre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={3}
                >
                  {userStats.genreBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {userStats.genreBreakdown.map((g, i) => (
              <span key={g.genre} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {g.genre} ({g.pct}%)
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Mood Patterns</h2>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={moodChartData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="mood" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Radar dataKey="value" stroke="hsl(36, 90%, 50%)" fill="hsl(36, 90%, 50%)" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Where You Watch</h2>
          </div>
          <div className="space-y-2.5">
            {userStats.platformBreakdown.map((p, i) => {
              const pct = maxPlatformCount > 0 ? (p.count / maxPlatformCount) * 100 : 0;

              return (
                <div key={p.platform} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right truncate">{p.platform}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{p.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Who You Watch With</h2>
          </div>
          <div className="space-y-2.5">
            {userStats.contextBreakdown.map((c, i) => {
              const pct = maxContextCount > 0 ? (c.count / maxContextCount) * 100 : 0;

              return (
                <div key={c.context} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right truncate">{c.context}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Viewing Rhythm</h2>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userStats.weekdayBreakdown}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(150, 50%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Rating Distribution</h2>
          </div>
          <div className="space-y-3">
            {userStats.ratingDistribution.map((d) => {
              const pct = maxRatingCount > 0 ? (d.count / maxRatingCount) * 100 : 0;
              return (
                <div key={d.stars} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-right">{d.stars}★</span>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: d.stars * 0.1 }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
