"use client";

import { memo } from "react";
import { EventActions } from "./EventActions";
import type { CalendarEvent } from "../lib/types";

interface CalendarEventListProps {
  events: CalendarEvent[];
  reminders: Set<string>;
  planned: Set<string>;
  onReminder: (id: string) => void;
  onPlanned: (id: string) => void;
}

export const CalendarEventList = memo(function CalendarEventList({ events, reminders, planned, onReminder, onPlanned }: CalendarEventListProps) {
  return <div className="space-y-3">{events.map((event) => <article key={event.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3">
    <img src={event.poster || undefined} alt="" className="h-16 w-12 rounded-xl object-cover" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{event.movieTitle}</p><p className="text-xs text-muted-foreground">{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {event.genre}</p></div>
    <EventActions hasReminder={reminders.has(event.id)} isPlanned={planned.has(event.id)} onReminder={() => onReminder(event.id)} onPlanned={() => onPlanned(event.id)} />
  </article>)}</div>;
});