"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Filter, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { movies, allTags, allGenres } from "@/data/mockData";

export default function Discover() {
  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"rating" | "year" | "title">("rating");

  const toggleFilter = (arr: string[], setArr: (a: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const filtered = movies
    .filter((m) => {
      if (query && !m.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (selectedGenres.length && !selectedGenres.includes(m.genre)) return false;
      if (selectedTags.length && !selectedTags.some((t) => m.tags.includes(t))) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "year") return b.year - a.year;
      return a.title.localeCompare(b.title);
    });

  const activeFilters = selectedGenres.length + selectedTags.length;

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Discover
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Filter and explore by genre, mood, tags, and more.
          </p>
        </motion.div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies…"
            className="w-full rounded-full bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        {/* Genre filters */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Genre</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleFilter(selectedGenres, setSelectedGenres, genre)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedGenres.includes(genre)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-foreground border-border hover:border-primary/50"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Tag filters */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Mood / Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleFilter(selectedTags, setSelectedTags, tag)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-secondary text-foreground border-border hover:border-accent/50"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Sort & active filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeFilters > 0 && (
              <button
                onClick={() => { setSelectedGenres([]); setSelectedTags([]); }}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <X className="h-3 w-3" /> Clear {activeFilters} filters
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "film" : "films"}
            </span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs rounded-lg bg-secondary border border-border px-3 py-1.5 text-foreground outline-none focus:border-primary"
          >
            <option value="rating">Highest Rated</option>
            <option value="year">Newest</option>
            <option value="title">A-Z</option>
          </select>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((movie, i) => (
            <MovieCard key={movie.id} movie={movie} index={i} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No films match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
