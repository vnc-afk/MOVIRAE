"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { GenreOption } from "../lib/types";

interface GenreFilterProps {
  genres: GenreOption[];
  selectedGenreId: string;
  onGenreChange: (genreId: string) => void;
}

/**
 * Small selectable button used inside the genre chip group.
 */
interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary text-foreground border-border hover:border-primary/50"
      }`}
    >
      {children}
    </motion.button>
  );
}

function ChipContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-wrap gap-2"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}


/**
 * Renders the selectable genre chip list for the discover page.
 */
export const GenreFilter = memo(function GenreFilter({
  genres,
  selectedGenreId,
  onGenreChange,
}: GenreFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-medium text-muted-foreground">Genre</span>
      </div>
      <ChipContainer>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Chip
            active={!selectedGenreId}
            onClick={() => onGenreChange("")}
          >
            All
          </Chip>
        </motion.div>
        {genres.map((genre, index) => (
          <motion.div
            key={genre.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: (index + 1) * 0.05 }}
          >
            <Chip
              active={selectedGenreId === String(genre.id)}
              onClick={() => onGenreChange(String(genre.id))}
            >
              {genre.name}
            </Chip>
          </motion.div>
        ))}
      </ChipContainer>
    </div>
  );
});
