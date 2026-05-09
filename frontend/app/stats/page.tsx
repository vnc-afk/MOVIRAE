"use client";

import { motion } from "framer-motion";
import { BarChart3, Clock, Film, Star, TrendingUp, Award, Calendar } from "lucide-react";
import { userStats, movies } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "hsl(36, 90%, 50%)",
  "hsl(150, 50%, 40%)",
  "hsl(220, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(45, 80%, 50%)",
  "hsl(180, 50%, 45%)",
];

export default function UserStats() {
  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Your Stats
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your year in review — films watched, genres explored, time spent.
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Film, label: "Films Watched", value: userStats.totalWatched.toString() },
            { icon: Clock, label: "Hours Watched", value: `${userStats.totalHours}h` },
            { icon: Star, label: "Avg Rating", value: userStats.avgRating.toFixed(1) },
            { icon: Award, label: "Fave Genre", value: userStats.favoriteGenre },
          ].map(({ icon: Icon, label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl bg-card p-5 card-shadow text-center"
            >
              <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Monthly chart */}
        <div className="rounded-xl bg-card p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">
              Films Per Month
            </h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userStats.monthlyBreakdown}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(36, 90%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Genre breakdown */}
          <div className="rounded-xl bg-card p-6 card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Genre Breakdown
              </h2>
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {userStats.genreBreakdown.map((g, i) => (
                <span key={g.genre} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {g.genre} ({g.pct}%)
                </span>
              ))}
            </div>
          </div>

          {/* Rating distribution */}
          <div className="rounded-xl bg-card p-6 card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Rating Distribution
              </h2>
            </div>
            <div className="space-y-3">
              {userStats.ratingDistribution.map((d) => {
                const maxCount = Math.max(...userStats.ratingDistribution.map((r) => r.count));
                const pct = (d.count / maxCount) * 100;
                return (
                  <div key={d.stars} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {d.stars}★
                    </span>
                    <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: d.stars * 0.1 }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">
                      {d.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
