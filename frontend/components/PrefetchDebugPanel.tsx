"use client";

import { useEffect, useState } from "react";
import { getPrefetchStats, resetPrefetchStats } from "@/lib/prefetchHelpers";
import telemetry from "@/lib/prefetchTelemetry";

const EMPTY_STATS = {
  attempts: 0,
  skipped: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
};

const EMPTY_TELEMETRY = {
  attempts: 0,
  skipped: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  hits: 0,
  misses: 0,
  lastUpdated: 0,
};

export function PrefetchDebugPanel() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [tele, setTele] = useState(EMPTY_TELEMETRY);

  useEffect(() => {
    const syncSnapshots = () => {
      setStats(getPrefetchStats());
      setTele(telemetry.getTelemetrySnapshot());
    };

    syncSnapshots();

    const interval = window.setInterval(() => {
      syncSnapshots();
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-64 rounded-xl border border-border bg-background/95 p-3 text-xs text-foreground shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prefetch</span>
        <button
          type="button"
          onClick={resetPrefetchStats}
          className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Attempts</div>
          <div className="mt-1 text-base font-semibold">{stats.attempts}</div>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Skipped</div>
          <div className="mt-1 text-base font-semibold">{stats.skipped}</div>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Succeeded</div>
          <div className="mt-1 text-base font-semibold">{stats.succeeded}</div>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Failed</div>
          <div className="mt-1 text-base font-semibold">{stats.failed}</div>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cancelled</div>
          <div className="mt-1 text-base font-semibold">{stats.cancelled}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-primary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Prefetch Hits</div>
          <div className="mt-1 text-base font-semibold">{tele.hits}</div>
        </div>
        <div className="rounded-lg bg-primary/60 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Prefetch Misses</div>
          <div className="mt-1 text-base font-semibold">{tele.misses}</div>
        </div>
        <div className="col-span-2 rounded-lg bg-primary/40 p-2">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Hit Rate</div>
          <div className="mt-1 text-base font-semibold">{tele.hits + tele.misses > 0 ? Math.round((tele.hits / (tele.hits + tele.misses)) * 100) + "%" : "—"}</div>
        </div>
        <div className="col-span-2 mt-2 flex justify-between">
          <button
            type="button"
            onClick={() => {
              telemetry.resetTelemetry();
              setTele(telemetry.getTelemetrySnapshot());
            }}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Reset Telemetry
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await telemetry.flushTelemetry();
                setTele(telemetry.getTelemetrySnapshot());
                // also update prefetch stats snapshot
                setStats(getPrefetchStats());
              } catch {}
            }}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Flush
          </button>
        </div>
      </div>
    </div>
  );
}
