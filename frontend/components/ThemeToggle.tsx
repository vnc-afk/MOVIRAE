"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle("dark", dark);
    }
  }, [dark, mounted]);

  if (!mounted) {
    return (
      <button
        disabled
        className="relative h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-accent transition-colors duration-200"
        aria-label="Toggle theme"
      >
        <Moon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setDark(!dark)}
      className="relative h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-accent transition-colors duration-200"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
