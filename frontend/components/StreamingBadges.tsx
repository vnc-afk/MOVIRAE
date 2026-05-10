"use client";

import { Tv } from "lucide-react";

interface StreamingBadgesProps {
  platforms: string[];
}

const platformColors: Record<string, string> = {
  Netflix: "bg-red-500/10 text-red-400 border-red-500/20",
  "Amazon Prime": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Hulu: "bg-green-500/10 text-green-400 border-green-500/20",
  "Disney+": "bg-blue-600/10 text-blue-300 border-blue-600/20",
  "Apple TV+": "bg-gray-500/10 text-gray-300 border-gray-500/20",
  "HBO Max": "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function StreamingBadges({ platforms }: StreamingBadgesProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tv className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Available on
        </span>
      </div>
      {platforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <span
              key={p}
              className={`text-xs px-2.5 py-1 rounded-full border ${platformColors[p] || "bg-secondary text-foreground border-border"}`}
            >
              {p}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No streaming availability found.</p>
      )}
    </div>
  );
}
