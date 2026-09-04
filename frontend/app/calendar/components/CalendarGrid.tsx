"use client";

import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, WEEK_DAYS } from "../lib/calendarUtils";
import type { CalendarEvent } from "../lib/types";

interface CalendarGridProps {
  month: number;
  year: number;
  selectedDay: number | null;
  eventsByDay: Map<number, CalendarEvent[]>;
  onNavigate: (direction: -1 | 1) => void;
  onSelectDay: (day: number) => void;
}

export const CalendarGrid = memo(function CalendarGrid({ month, year, selectedDay, eventsByDay, onNavigate, onSelectDay }: CalendarGridProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-6" aria-label={`${MONTHS[month]} ${year} calendar`}>
      <div className="mb-6 flex items-center justify-between">
        <button type="button" title="Previous month" aria-label="Previous month" onClick={() => onNavigate(-1)} className="rounded-full p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
        <h2 className="font-display text-lg font-bold text-foreground">{MONTHS[month]} {year}</h2>
        <button type="button" title="Next month" aria-label="Next month" onClick={() => onNavigate(1)} className="rounded-full p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1">{WEEK_DAYS.map((day) => <div key={day} className="py-1 text-center text-xs font-medium text-muted-foreground">{day}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }, (_, index) => <div key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const dayEvents = eventsByDay.get(day) ?? [];
          const selected = selectedDay === day;
          return <button type="button" key={day} onClick={() => onSelectDay(day)} className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${selected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" : "text-foreground hover:bg-secondary"}`}>
            {day}
            {dayEvents.length > 0 && (() => {
              const markerEvent = dayEvents.find((event) => event.type === "reminder")
                ?? dayEvents.find((event) => event.type === "planned")
                ?? dayEvents[0];
              const markerColor = selected
                ? "bg-primary-foreground"
                : markerEvent.type === "reminder"
                  ? "bg-destructive"
                  : markerEvent.type === "planned"
                    ? "bg-accent"
                    : "bg-orange-500";

              return <span className="mt-1" aria-label={`${dayEvents.length} events`}><span className={`block h-1.5 w-1.5 rounded-full ${markerColor}`} /></span>;
            })()}
          </button>;
        })}
      </div>
    </section>
  );
});