"use client";

import { Bell, Clock, Film } from "lucide-react";
import type { CalendarEvent } from "../lib/types";

interface CalendarSidebarProps { releases: CalendarEvent[]; planned: CalendarEvent[]; }

function MiniList({ events }: { events: CalendarEvent[] }) {
  return <div className="space-y-2">{events.map((event) => <div key={event.id} className="flex items-center gap-2.5"><img src={event.poster || undefined} alt="" className="h-11 w-8 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{event.movieTitle}</p><p className="text-[10px] text-muted-foreground">{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></div></div>)}</div>;
}

export function CalendarSidebar({ releases, planned }: CalendarSidebarProps) {
  return <aside className="space-y-6"><section className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2"><Film className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Upcoming Releases</h3></div><MiniList events={releases.slice(0, 4)} /></section><section className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-accent-foreground" /><h3 className="text-sm font-semibold text-foreground">My Watch Plan</h3></div>{planned.length ? <MiniList events={planned} /> : <p className="text-xs text-muted-foreground">No movies planned yet.</p>}</section><section className="rounded-2xl border border-border bg-card p-4"><h3 className="mb-2 text-xs font-semibold text-foreground">Legend</h3><div className="space-y-1.5 text-xs text-muted-foreground"><p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />New Release</p><p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent" />Planned Watch</p><p><Bell className="mr-2 inline-block h-3.5 w-3.5 text-destructive" />Reminder</p></div></section></aside>;
}