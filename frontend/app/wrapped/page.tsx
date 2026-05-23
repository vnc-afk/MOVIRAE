"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Film, Clock, Star, Award, MapPin, Heart, Users, Sparkles, BarChart3 } from "lucide-react";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";
import type { Movie, UserStats } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell } from "recharts";

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

interface SlideProps {
  children: React.ReactNode;
  bgClass?: string;
}

function Slide({ children, bgClass = "" }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: 60 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: -60 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-12 ${bgClass}`}
    >
      {children}
    </motion.div>
  );
}

export default function Wrapped() {
  const [slideIndex, setSlideIndex] = useState(0);
  const totalSlides = 7;
  const wrappedQuery = usePrefetchAwareQuery<UserStats | null>({
    queryKey: queryKeys.wrapped.current(),
    queryFn: async () => {
      const response = await fetch("/api/data/user-wrapped");
      const data = await response.json();
      return data.value ?? null;
    },
    enabled: true,
  });

  const stats = wrappedQuery.data ?? null;

  const userStats: UserStats = stats ?? {
    totalWatched: 0,
    totalHours: 0,
    avgRating: 0,
    favoriteGenre: "",
    topDirector: "",
    longestStreak: 0,
    countriesExplored: 0,
    monthlyBreakdown: [],
    genreBreakdown: [],
    ratingDistribution: [],
    moodBreakdown: [],
    platformBreakdown: [],
    contextBreakdown: [],
    weekdayBreakdown: [],
  };
  const movies: Movie[] = [];

  const next = () => setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
  const prev = () => setSlideIndex((i) => Math.max(i - 1, 0));

  const radarData = userStats.moodBreakdown.map((m) => ({
    mood: m.mood,
    value: m.count,
  }));

  const slides = [
    // Slide 0: Intro
    <Slide key="intro">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
        <Sparkles className="h-16 w-16 text-primary mx-auto mb-6" />
      </motion.div>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-3">Your 2025 Wrapped</h1>
      <p className="text-muted-foreground text-lg max-w-md">A look back at your year in cinema. Every frame, every feeling, every moment.</p>
    </Slide>,

    // Slide 1: Big numbers
    <Slide key="numbers">
      <h2 className="font-display text-lg text-muted-foreground mb-8">This year, you watched</h2>
      <div className="grid grid-cols-2 gap-6 max-w-sm w-full">
        {[
          { icon: Film, value: userStats.totalWatched, label: "Films", delay: 0.1 },
          { icon: Clock, value: `${userStats.totalHours}h`, label: "Hours", delay: 0.2 },
          { icon: Star, value: userStats.avgRating.toFixed(1), label: "Avg Rating", delay: 0.3 },
          { icon: MapPin, value: userStats.countriesExplored, label: "Countries", delay: 0.4 },
        ].map(({ icon: Icon, value, label, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-xl bg-card p-5 card-shadow"
          >
            <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6">
        <p className="text-sm text-muted-foreground">
          🔥 Longest streak: <span className="text-foreground font-semibold">{userStats.longestStreak} days</span>
        </p>
      </motion.div>
    </Slide>,

    // Slide 2: Genre breakdown
    <Slide key="genres">
      <h2 className="font-display text-lg text-muted-foreground mb-2">Your genre personality</h2>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={userStats.genreBreakdown}
                dataKey="count"
                nameKey="genre"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={3}
                animationBegin={300}
                animationDuration={800}
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
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {userStats.genreBreakdown.map((g, i) => (
            <span key={g.genre} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {g.genre} ({g.pct}%)
            </span>
          ))}
        </div>
      </motion.div>
      <p className="text-sm text-muted-foreground mt-4">
        Your top genre: <span className="text-primary font-bold">{userStats.favoriteGenre}</span>
      </p>
    </Slide>,

    // Slide 3: Mood radar
    <Slide key="mood">
      <h2 className="font-display text-lg text-muted-foreground mb-2">Your emotional landscape</h2>
      <p className="text-xs text-muted-foreground mb-4">The moods you gravitated toward this year</p>
      <motion.div
        initial={{ opacity: 0, rotate: -10 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="mood" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Radar dataKey="value" stroke="hsl(36, 90%, 50%)" fill="hsl(36, 90%, 50%)" fillOpacity={0.3} animationDuration={1000} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </Slide>,

    // Slide 4: How you watched
    <Slide key="how">
      <h2 className="font-display text-lg text-muted-foreground mb-6">How you watched</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl w-full">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-xl bg-card p-5 card-shadow">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Platform</p>
          <div className="space-y-2">
            {userStats.platformBreakdown.slice(0, 5).map((p, i) => {
              const maxCount = Math.max(...userStats.platformBreakdown.map((x) => x.count));
              return (
                <div key={p.platform} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 text-right truncate">{p.platform}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.count / maxCount) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{p.count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="rounded-xl bg-card p-5 card-shadow">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Watch Context</p>
          <div className="space-y-2">
            {userStats.contextBreakdown.map((c, i) => {
              const maxCount = Math.max(...userStats.contextBreakdown.map((x) => x.count));
              return (
                <div key={c.context} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 text-right truncate">{c.context}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.count / maxCount) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{c.count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </Slide>,

    // Slide 5: Weekday habits
    <Slide key="weekday">
      <h2 className="font-display text-lg text-muted-foreground mb-2">Your viewing rhythm</h2>
      <p className="text-xs text-muted-foreground mb-4">When you watched most</p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md"
      >
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userStats.weekdayBreakdown}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="hsl(36, 90%, 50%)" radius={[6, 6, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      <p className="text-sm text-muted-foreground mt-3">
        Peak day: <span className="text-primary font-bold">Saturday</span> with 48 films 🍿
      </p>
    </Slide>,

    // Slide 6: Summary
    <Slide key="summary">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring" }}>
        <Award className="h-16 w-16 text-primary mx-auto mb-6" />
      </motion.div>
      <h2 className="font-display text-3xl font-bold text-foreground mb-3">You're a Cinema Connoisseur</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        {userStats.totalWatched} films, {userStats.totalHours} hours, {userStats.countriesExplored} countries explored.
        Your love for {userStats.favoriteGenre || "movies"} defines your taste, and your {userStats.longestStreak}-day streak shows true dedication.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {["🎬 Cinephile", "🔥 Streak Master", "🌍 World Explorer", `⭐ ${userStats.favoriteGenre} Fan`].map((badge) => (
          <motion.span
            key={badge}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + Math.random() * 0.3, type: "spring" }}
            className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
          >
            {badge}
          </motion.span>
        ))}
      </div>
    </Slide>,
  ];

  return (
    <div className="pb-20 md:pb-0 min-h-screen">
      <div className="container py-6">
        {/* Progress bar */}
        <div className="flex items-center gap-1.5 mb-4 max-w-md mx-auto">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-secondary">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: i <= slideIndex ? "100%" : "0%" }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {slides[slideIndex]}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={prev}
            disabled={slideIndex === 0}
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground">
            {slideIndex + 1} / {totalSlides}
          </span>
          <button
            onClick={next}
            disabled={slideIndex === totalSlides - 1}
            className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}