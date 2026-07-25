
import { motion } from "framer-motion";
import type { Movie } from "@/lib/types";
import { StarRating } from "@/components/StarRating";

interface MovieHeaderProps {
  movie: Movie;
  poster: string;
}

/**
 * Displays the top section of movie details including title, metadata,
 * rating, synopsis, and tag chips.
 */
export function MovieHeader({ movie, poster }: MovieHeaderProps) {
  return (
    <>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 pt-2"
      >
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{movie.year}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span>{movie.genre}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span>Dir. {movie.director}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span>{movie.runtime} min</span>
        </div>

        <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground">
          {movie.title}
        </h1>

        <div className="flex items-center gap-3 mt-3">
          <StarRating rating={movie.rating} size="lg" />
          <span className="text-lg font-semibold text-foreground">
            {movie.rating.toFixed(1)}
          </span>
        </div>

        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xl">
          {movie.synopsis}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {movie.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border"
            >
              #{tag}
            </span>
          ))}
        </div>
      </motion.div>
    </>
  );
}
