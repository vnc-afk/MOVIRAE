"use client";

interface StatsErrorStateProps {
  onRetry: () => void;
}

export function StatsErrorState({ onRetry }: StatsErrorStateProps) {
  return (
    <div className="container py-8">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive-foreground">
        <p className="mb-4">Unable to load your stats.</p>
        <button className="rounded-full border border-destructive px-4 py-2 text-sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}
