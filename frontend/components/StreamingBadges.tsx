"use client";

import { Tv } from "lucide-react";

interface StreamingBadgesProps {
  platforms: string[];
  loading?: boolean;
}

const platformColors: Record<string, string> = {
  Netflix: "bg-red-500/10 text-red-400 border-red-500/20",
  "Amazon Prime": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Hulu: "bg-green-500/10 text-green-400 border-green-500/20",
  "Disney+": "bg-blue-600/10 text-blue-300 border-blue-600/20",
  "Apple TV+": "bg-gray-500/10 text-gray-300 border-gray-500/20",
  "HBO Max": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Paramount+": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  Peacock: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  "Google Play": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  Vudu: "bg-orange-500/10 text-orange-300 border-orange-500/20",
};

const fallbackPlatformColors = [
  "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  "bg-pink-500/10 text-pink-300 border-pink-500/20",
  "bg-lime-500/10 text-lime-300 border-lime-500/20",
  "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
];

function getPlatformColor(platform: string) {
  if (platformColors[platform]) {
    return platformColors[platform];
  }

  const hash = Array.from(platform).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  return fallbackPlatformColors[hash % fallbackPlatformColors.length];
}

export function StreamingBadges({ platforms, loading = false }: StreamingBadgesProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tv className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Available on
        </span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Checking streaming availability...</p>
      ) : platforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <span
              key={p}
              className={`text-xs px-2.5 py-1 rounded-full border ${getPlatformColor(p)}`}
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
