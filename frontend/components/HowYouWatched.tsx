import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Users, Heart, Popcorn, Clapperboard, Check } from "lucide-react";
import type { WatchPlatform, WatchContext, Mood } from "@/data/mockData";

const platforms: { value: WatchPlatform; icon: React.ReactNode; label: string }[] = [
  { value: "Cinema", icon: <Clapperboard className="h-4 w-4" />, label: "Cinema" },
  { value: "Netflix", icon: <Monitor className="h-4 w-4" />, label: "Netflix" },
  { value: "Amazon Prime", icon: <Monitor className="h-4 w-4" />, label: "Prime" },
  { value: "Disney+", icon: <Monitor className="h-4 w-4" />, label: "Disney+" },
  { value: "HBO Max", icon: <Monitor className="h-4 w-4" />, label: "HBO" },
  { value: "Apple TV+", icon: <Monitor className="h-4 w-4" />, label: "Apple TV+" },
  { value: "Hulu", icon: <Monitor className="h-4 w-4" />, label: "Hulu" },
  { value: "Blu-ray", icon: <Monitor className="h-4 w-4" />, label: "Blu-ray" },
];

const contexts: { value: WatchContext; emoji: string }[] = [
  { value: "Solo", emoji: "🎧" },
  { value: "With Friends", emoji: "👥" },
  { value: "Date Night", emoji: "💑" },
  { value: "Family", emoji: "👨‍👩‍👧" },
  { value: "Movie Club", emoji: "🎬" },
];

const moods: { value: Mood; emoji: string }[] = [
  { value: "Thrilling", emoji: "😱" },
  { value: "Relaxing", emoji: "😌" },
  { value: "Romantic", emoji: "🥰" },
  { value: "Dark", emoji: "🌑" },
  { value: "Uplifting", emoji: "✨" },
  { value: "Thought-Provoking", emoji: "🤔" },
  { value: "Fun", emoji: "🎉" },
  { value: "Intense", emoji: "🔥" },
];

interface Props {
  movieTitle: string;
  onSave?: (data: { platform: WatchPlatform; context: WatchContext; mood: Mood }) => void;
}

export function HowYouWatched({ movieTitle, onSave }: Props) {
  const [platform, setPlatform] = useState<WatchPlatform | null>(null);
  const [context, setContext] = useState<WatchContext | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (platform && context && mood) {
      onSave?.({ platform, context, mood });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="rounded-xl bg-card p-5 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <Popcorn className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-bold text-foreground">How did you watch {movieTitle}?</h3>
      </div>

      {/* Platform */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Where did you watch?</p>
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                platform === p.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-foreground border-border hover:border-primary/50"
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Context */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Who were you with?</p>
        <div className="flex flex-wrap gap-1.5">
          {contexts.map((c) => (
            <button
              key={c.value}
              onClick={() => setContext(c.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                context === c.value
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-secondary text-foreground border-border hover:border-accent/50"
              }`}
            >
              {c.emoji} {c.value}
            </button>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">What was the vibe?</p>
        <div className="flex flex-wrap gap-1.5">
          {moods.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                mood === m.value
                  ? "bg-primary/80 text-primary-foreground border-primary/80"
                  : "bg-secondary text-foreground border-border hover:border-primary/30"
              }`}
            >
              {m.emoji} {m.value}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {platform && context && mood && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={handleSave}
            className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {saved ? <><Check className="h-4 w-4" /> Saved!</> : "Log Watch Experience"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}