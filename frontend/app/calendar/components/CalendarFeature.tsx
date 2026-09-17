"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { attachOpToBody, attachOpToHeaders, generateOpId } from "@/lib/optimistic";
import { useCalendarData, useCalendarUrlState } from "../hooks";
import { getEventsForDay, getMonthParts, shiftMonth } from "../lib/calendarUtils";
import type { CalendarEvent } from "../lib/types";
import { CalendarEventList } from "./CalendarEventList";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarLoadingSkeleton } from "./CalendarLoadingSkeleton";
import { SelectedDayEvents } from "./SelectedDayEvents";

export function CalendarFeature() {
  const { query, setMonth, setView } = useCalendarUrlState();
  const { events, isLoading, error } = useCalendarData(query.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(() => new Set());
  const [plannedIds, setPlannedIds] = useState<Set<string>>(() => new Set());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const inFlightActionsRef = useRef(new Set<string>());
  const { addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const { year, month } = getMonthParts(query.month);

  const releases = useMemo(
    () => events
      .filter((event) => event.type === "release")
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.date.localeCompare(b.date)),
    [events]
  );
  const planned = useMemo(() => events.filter((event) => plannedIds.has(event.id)), [events, plannedIds]);
  const eventsByDay = useMemo(
    () => new Map(
      Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1)
        .map((day) => [day, getEventsForDay(events, query.month, day)])
    ),
    [events, month, query.month, year]
  );
  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];

  useEffect(() => {
    setReminders(new Set(events.filter((event) => event.reminderId || event.type === "reminder").map((event) => event.id)));
    setPlannedIds(new Set(events.filter((event) => event.type === "planned").map((event) => event.id)));
  }, [events]);

  const toggle = useCallback(async (type: "reminder" | "planned", id: string) => {
    const event = events.find((entry) => entry.id === id);
    if (!event) return;

    const actionKey = `${type}:${id}`;
    if (inFlightActionsRef.current.has(actionKey)) return;
    inFlightActionsRef.current.add(actionKey);

    const opId = generateOpId(`calendar-${type}`);
    const active = type === "reminder" ? reminders.has(id) : plannedIds.has(id);
    const setter = type === "reminder" ? setReminders : setPlannedIds;
    const operation = { opId, type: active ? ("delete" as const) : ("create" as const), ts: Date.now() };

    addInFlightOp(opId, { type: operation.type, itemId: id, surface: "calendar", payload: { type } });
    setter((current) => {
      const next = new Set(current);
      active ? next.delete(id) : next.add(id);
      return next;
    });
    setMutationError(null);

    const tmdbId = event.tmdbId ?? event.id;
    try {
      const response = active
        ? await fetch(`/api/calendar?tmdbId=${encodeURIComponent(tmdbId)}&date=${event.date}&type=${type}`, {
            method: "DELETE",
            headers: attachOpToHeaders(undefined, operation),
          })
        : await fetch("/api/calendar", {
            method: "POST",
            headers: attachOpToHeaders({ "Content-Type": "application/json" }, operation),
            body: JSON.stringify(attachOpToBody({
              tmdbId,
              movieTitle: event.movieTitle,
              date: event.date,
              type,
              poster: event.poster || null,
              genre: event.genre,
            }, operation)),
          });

      if (!response.ok) throw new Error("Could not update calendar item.");
    } catch (cause) {
      setter((current) => {
        const next = new Set(current);
        active ? next.add(id) : next.delete(id);
        return next;
      });
      setMutationError(cause instanceof Error ? cause.message : "Could not update calendar item.");
    } finally {
      removeInFlightOp(opId);
      inFlightActionsRef.current.delete(actionKey);
    }
  }, [addInFlightOp, events, plannedIds, removeInFlightOp, reminders]);

  return (
    <main className="pb-20 md:pb-0">
      <div className="container space-y-6 py-8">
        <header>
          <div className="mb-1 flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-primary" /><h1 className="font-display text-2xl font-bold text-foreground">Movie Calendar</h1></div>
          <p className="text-sm text-muted-foreground">Track upcoming releases, set reminders, and plan your watch schedule.</p>
        </header>
        {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error.message}</div>}
        {mutationError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{mutationError}</div>}
        <div className="flex gap-2" role="tablist">
          {(["calendar", "list"] as const).map((view) => <button type="button" role="tab" aria-selected={query.view === view} key={view} onClick={() => setView(view)} className={`rounded-full border px-4 py-2 text-xs font-medium capitalize ${query.view === view ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"}`}>{view}</button>)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isLoading ? <CalendarLoadingSkeleton /> : query.view === "calendar" ? <>
              <CalendarGrid month={month} year={year} selectedDay={selectedDay} eventsByDay={eventsByDay} reminders={reminders} planned={plannedIds} onNavigate={(direction) => { setMonth(shiftMonth(query.month, direction)); setSelectedDay(null); }} onSelectDay={(day) => setSelectedDay(selectedDay === day ? null : day)} />
              {selectedDay && <SelectedDayEvents dateLabel={`${new Date(year, month, selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`} events={selectedEvents} reminders={reminders} planned={plannedIds} onReminder={(id) => toggle("reminder", id)} onPlanned={(id) => toggle("planned", id)} />}
            </> : <CalendarEventList events={releases} reminders={reminders} planned={plannedIds} onReminder={(id) => toggle("reminder", id)} onPlanned={(id) => toggle("planned", id)} />}
          </div>
          <CalendarSidebar releases={releases} planned={planned} />
        </div>
      </div>
    </main>
  );
}
