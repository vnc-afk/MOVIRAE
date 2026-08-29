"use client";

import { motion } from "framer-motion";
import { ANIMATION_DELAYS } from "../../lib/constants";

interface SlideProps {
  children: React.ReactNode;
  bgClass?: string;
}

/**
 * Reusable slide wrapper with entrance animation
 * Decoupled from content, fully composable
 */
export function Slide({ children, bgClass = "" }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: 60 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: -60 }}
      transition={{
        duration: ANIMATION_DELAYS.SLIDE_TRANSITION,
        ease: "easeOut",
      }}
      className={`min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-12 ${bgClass}`}
    >
      {children}
    </motion.div>
  );
}
