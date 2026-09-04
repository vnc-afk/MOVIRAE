import type { CalendarEvent } from "./types";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const currentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

export function getMonthParts(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const fallback = currentMonthKey().split("-").map(Number);
  return { year: year || fallback[0], month: month ? month - 1 : fallback[1] - 1 };
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(monthKey: string, direction: -1 | 1) {
  const { year, month } = getMonthParts(monthKey);
  return getMonthKey(new Date(year, month + direction, 1));
}

export function getEventsForDay(events: CalendarEvent[], monthKey: string, day: number) {
  return events.filter((event) => event.date === `${monthKey}-${String(day).padStart(2, "0")}`);
}

export function dedupeEvents(events: CalendarEvent[]) {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}