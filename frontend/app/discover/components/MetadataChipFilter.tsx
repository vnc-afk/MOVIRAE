"use client";

import { memo } from "react";
import { motion } from "framer-motion";

interface MetadataChipFilterProps {
  label: string;
  options: readonly string[];
  selectedValues: readonly string[];
  onToggle: (value: string) => void;
}

/**
 * Small selectable button used inside the metadata chip group.
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
 * Renders selectable metadata chip list (mood/vibe, tags, etc.) for the discover page.
 */
export const MetadataChipFilter = memo(function MetadataChipFilter({
  label,
  options,
  selectedValues,
  onToggle,
}: MetadataChipFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <ChipContainer>
        {options.map((option, index) => (
          <motion.div
            key={option}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Chip
              active={selectedValues.includes(option)}
              onClick={() => onToggle(option)}
            >
              {option}
            </Chip>
          </motion.div>
        ))}
      </ChipContainer>
    </div>
  );
});
