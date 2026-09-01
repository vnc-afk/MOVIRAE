import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Users, Heart, Popcorn, Clapperboard, Check } from "lucide-react";
import type { Mood, WatchContext, WatchExperience, WatchPlatform } from "@/lib/types";
import { WATCH_CONTEXTS, WATCH_MOODS, WATCH_PLATFORMS } from "@/lib/features/watch/options";

const platforms: { value: WatchPlatform; icon: ReactNode; label: string }[] = [
  { value: WATCH_PLATFORMS[0], icon: <Clapperboard className="h-4 w-4" />, label: "Cinema" },
  { value: WATCH_PLATFORMS[1], icon: <Monitor className="h-4 w-4" />, label: "Netflix" },
  { value: WATCH_PLATFORMS[2], icon: <Monitor className="h-4 w-4" />, label: "Prime" },
  { value: WATCH_PLATFORMS[4], icon: <Monitor className="h-4 w-4" />, label: "Disney+" },
  { value: WATCH_PLATFORMS[6], icon: <Monitor className="h-4 w-4" />, label: "HBO" },
  { value: WATCH_PLATFORMS[5], icon: <Monitor className="h-4 w-4" />, label: "Apple TV+" },
  { value: WATCH_PLATFORMS[3], icon: <Monitor className="h-4 w-4" />, label: "Hulu" },
  { value: WATCH_PLATFORMS[7], icon: <Monitor className="h-4 w-4" />, label: "Blu-ray" },
];

const contexts: { value: WatchContext; emoji: string }[] = [
  { value: WATCH_CONTEXTS[0], emoji: "🎧" },
  { value: WATCH_CONTEXTS[1], emoji: "👥" },
  { value: WATCH_CONTEXTS[2], emoji: "💑" },
  { value: WATCH_CONTEXTS[3], emoji: "👨‍👩‍👧" },
  { value: WATCH_CONTEXTS[4], emoji: "🎬" },
];

const moods: { value: Mood; emoji: string }[] = [
  { value: WATCH_MOODS[0], emoji: "😱" },
  { value: WATCH_MOODS[1], emoji: "😌" },
  { value: WATCH_MOODS[2], emoji: "🥰" },
  { value: WATCH_MOODS[3], emoji: "🌑" },
  { value: WATCH_MOODS[4], emoji: "✨" },
  { value: WATCH_MOODS[5], emoji: "🤔" },
  { value: WATCH_MOODS[6], emoji: "🎉" },
  { value: WATCH_MOODS[7], emoji: "🔥" },
];

interface Props {
  movieTitle: string;
  initialValue?: WatchExperience | null;
  onSave?: (data: WatchExperience) => void | Promise<void>;
  disabled?: boolean;
}

export function HowYouWatched({ movieTitle, initialValue, onSave, disabled = false }: Props) {
  const [platform, setPlatform] = useState<WatchPlatform | null>(null);
  const [context, setContext] = useState<WatchContext | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlatform(initialValue?.platform ?? null);
    setContext(initialValue?.context ?? null);
    setMood(initialValue?.mood ?? null);
  }, [initialValue?.platform, initialValue?.context, initialValue?.mood]);

  const handleSave = async () => {
    if (disabled || saving) {
      return;
    }

    if (platform && context && mood) {
      setSaving(true);

      try {
        await onSave?.({ platform, context, mood });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } finally {
        setSaving(false);
      }
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
            disabled={disabled || saving}
            className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving..." : saved ? <><Check className="h-4 w-4" /> Saved!</> : "Log Watch Experience"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}