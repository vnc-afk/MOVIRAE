"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Plus } from "lucide-react";
import { StarRating } from "./StarRating";
import type { Movie } from "@/data/mockData";

interface MovieCardProps {
  movie: Movie;
  index?: number;
}

export function MovieCard({ movie, index = 0 }: MovieCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={`/movie/${movie.id}`} className="group block">
        <div className="relative overflow-hidden rounded-lg poster-shadow">
          <img
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            width={640}
            height={960}
            className="w-full aspect-[2/3] object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <div className="flex gap-2 mb-3">
              <button className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                <Eye className="h-3.5 w-3.5" /> Watched
              </button>
              <button className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:opacity-90 transition-opacity">
                <Plus className="h-3.5 w-3.5" /> Watchlist
              </button>
            </div>
            <p className="text-sm text-primary-foreground/80 line-clamp-2">
              {movie.synopsis}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{movie.year}</span>
            <StarRating rating={movie.rating} size="sm" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
