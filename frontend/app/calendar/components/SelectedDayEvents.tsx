"use client";

import { EventActions } from "./EventActions";
import type { CalendarEvent } from "../lib/types";

interface SelectedDayEventsProps {
  dateLabel: string;
  events: CalendarEvent[];
  reminders: Set<string>;
  planned: Set<string>;
  onReminder: (id: string) => void;
  onPlanned: (id: string) => void;
}

export function SelectedDayEvents({ dateLabel, events, reminders, planned, onReminder, onPlanned }: SelectedDayEventsProps) {
  return <section className="mt-4 space-y-3 border-t border-border pt-4"><h3 className="text-sm font-medium text-foreground">{dateLabel}</h3>{events.length === 0 ? <p className="text-xs text-muted-foreground">No events this day.</p> : events.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-2"><img src={event.poster || undefined} alt="" className="h-14 w-10 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{event.movieTitle}</p><p className="text-xs capitalize text-muted-foreground">{event.type} · {event.genre}</p></div><EventActions hasReminder={reminders.has(event.id)} isPlanned={planned.has(event.id)} onReminder={() => onReminder(event.id)} onPlanned={() => onPlanned(event.id)} /></div>)}</section>;
}