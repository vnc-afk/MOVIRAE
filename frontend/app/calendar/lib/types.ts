export type CalendarEventType = "release" | "planned" | "reminder";

export interface CalendarEvent {
  id: string;
  tmdbId?: string;
  movieTitle: string;
  date: string;
  popularity?: number;
  type: CalendarEventType;
  poster: string;
  genre: string;
  reminderId?: string;
}

export type CalendarView = "calendar" | "list";

export interface CalendarQuery {
  month: string;
  view: CalendarView;
}

export interface CalendarPage {
  results: CalendarEvent[];
  pageSize: number;
  hasMore: boolean;
}