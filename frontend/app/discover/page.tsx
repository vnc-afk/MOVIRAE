"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter,
  Search,
  SlidersHorizontal,
  X,
  Clock,
  Sparkles,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { Slider } from "@/components/ui/slider";
import { getGenres, getMoviesByGenre, getTrendingMovies, searchMovies } from "@/lib/tmdb";
import type { Movie } from "@/data/mockData";

interface FilterState {
  query: string;
  genreId: string;
  runtimeRange: [number, number];
  sortBy: "rating" | "year" | "title" | "runtime";
}

interface GenreOption {
  id: number;
  name: string;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: {
    genreId?: string;
    minRuntime?: number;
    maxRuntime?: number;
  };
}

const defaultFilters: FilterState = {
  query: "",
  genreId: "",
  runtimeRange: [0, 200],
  sortBy: "rating",
};

const defaultPresets: FilterPreset[] = [
  {
    id: "fp1",
    name: "Quick Picks",
    filters: { maxRuntime: 120 },
  },
  {
    id: "fp2",
    name: "Epic Runtime",
    filters: { minRuntime: 140 },
  },
  {
    id: "fp3",
    name: "Action Night",
    filters: { genreId: "28" },
  },
];

export default function Discover() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [userPresets, setUserPresets] = useState<FilterPreset[]>(defaultPresets);
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const toggleArr = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const update = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    setFilters((current) => ({ ...current, [key]: val }));

  useEffect(() => {
    async function loadGenres() {
      const genreList = await getGenres();
      setGenres(genreList);
    }

    loadGenres();
  }, []);

  useEffect(() => {
    async function loadMovies() {
      setLoading(true);
      try {
        const trimmedQuery = filters.query.trim();
        let results: Movie[] = [];

        if (trimmedQuery) {
          results = await searchMovies(trimmedQuery);
        } else if (filters.genreId) {
          results = await getMoviesByGenre(Number(filters.genreId));
        } else {
          results = await getTrendingMovies(1);
        }

        setMovies(results);
      } catch (error) {
        console.error("Failed to load discover movies:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }

    loadMovies();
  }, [filters.query, filters.genreId]);

  const filtered = useMemo(() => {
    return movies
      .filter((movie) => {
        if (movie.runtime < filters.runtimeRange[0] || movie.runtime > filters.runtimeRange[1]) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "rating") return b.rating - a.rating;
        if (filters.sortBy === "year") return b.year - a.year;
        if (filters.sortBy === "runtime") return a.runtime - b.runtime;
        return a.title.localeCompare(b.title);
      });
  }, [filters.runtimeRange, filters.sortBy, movies]);

  const activeCount = (filters.genreId ? 1 : 0) + (filters.runtimeRange[0] > 0 || filters.runtimeRange[1] < 200 ? 1 : 0);

  const applyPreset = (preset: FilterPreset) => {
    setFilters({
      ...defaultFilters,
      genreId: preset.filters.genreId || "",
      runtimeRange: [preset.filters.minRuntime || 0, preset.filters.maxRuntime || 200],
    });
  };

  const savePreset = () => {
    if (!presetName.trim()) return;

    setUserPresets((current) => [
      ...current,
      {
        id: `fp-${Date.now()}`,
        name: presetName,
        filters: {
          genreId: filters.genreId,
          minRuntime: filters.runtimeRange[0],
          maxRuntime: filters.runtimeRange[1],
        },
      },
    ]);

    setPresetName("");
    setShowSavePreset(false);
  };

  const Chip = ({
    active,
    onClick,
    children,
    variant = "genre",
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    variant?: "genre" | "preset";
  }) => {
    const activeStyles: Record<string, string> = {
      genre: "bg-primary text-primary-foreground border-primary",
      preset: "bg-accent text-accent-foreground border-accent",
    };

    return (
      <button
        onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
          active ? activeStyles[variant] : "bg-secondary text-foreground border-border hover:border-primary/50"
        }`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Smart Discover</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Search TMDB movies, filter by genre, and sort by runtime or rating.
          </p>
        </motion.div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Saved Presets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {userPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
              >
                ✨ {preset.name}
              </button>
            ))}
            <button
              onClick={() => setShowSavePreset((current) => !current)}
              className="text-xs px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Save className="h-3 w-3" /> Save Current
            </button>
          </div>
          <AnimatePresence>
            {showSavePreset && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mt-2 max-w-sm">
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name…"
                    className="flex-1 text-xs rounded-full bg-secondary pl-3 pr-3 py-1.5 border border-border focus:border-primary outline-none text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={savePreset}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-medium"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
            placeholder="Search movies…"
            className="w-full rounded-full bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Genre</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={!filters.genreId} onClick={() => update("genreId", "")} variant="genre">
              All
            </Chip>
            {genres.map((genre) => (
              <Chip
                key={genre.id}
                active={filters.genreId === String(genre.id)}
                onClick={() => update("genreId", String(genre.id))}
                variant="genre"
              >
                {genre.name}
              </Chip>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? "Hide" : "Show"} Advanced Filters
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-5"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Duration: {filters.runtimeRange[0]}–{filters.runtimeRange[1]} min
                  </span>
                </div>
                <div className="max-w-sm px-1">
                  <Slider
                    min={0}
                    max={200}
                    step={5}
                    value={filters.runtimeRange}
                    onValueChange={(value) => update("runtimeRange", value as [number, number])}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={() => setFilters(defaultFilters)}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <X className="h-3 w-3" /> Clear {activeCount} filters
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading films..." : `${filtered.length} ${filtered.length === 1 ? "film" : "films"}`}
            </span>
          </div>
          <select
            value={filters.sortBy}
            onChange={(e) => update("sortBy", e.target.value as FilterState["sortBy"])}
            className="text-xs rounded-lg bg-secondary border border-border px-3 py-1.5 text-foreground outline-none focus:border-primary"
          >
            <option value="rating">Highest Rated</option>
            <option value="year">Newest</option>
            <option value="title">A-Z</option>
            <option value="runtime">Shortest First</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-secondary h-48 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filtered.map((movie, index) => (
              <MovieCard key={movie.id} movie={movie} index={index} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No films match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
