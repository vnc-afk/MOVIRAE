"use client";

import { Search } from "lucide-react";
import { useState } from "react";

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchInput({
  placeholder = "Search movies, people, lists…",
  onSearch,
  className = "",
}: SearchInputProps) {
  const [query, setQuery] = useState("");

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch?.(e.target.value);
        }}
        placeholder={placeholder}
        className="w-full rounded-full bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
      />
    </div>
  );
}
