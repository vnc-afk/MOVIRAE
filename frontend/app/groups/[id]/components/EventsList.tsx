"use client";

import { EventCard } from "./EventCard";
import { AddEventForm } from "./AddEventForm";
import { sortEventsByDate } from "../../lib/groupUtils";
import type { GroupEventRecord } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

/**
 * Props for the events tab content.
 */
interface EventsListProps {
  events: GroupEventRecord[];
  onAddEvent: (
    title: string,
    startDate: string,
    startTime: string,
    description?: string
  ) => Promise<void>;
  onRsvp: (eventId: string, status: "yes" | "no" | "maybe") => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  currentUser: UserProfile | null;
  isAdmin?: boolean;
  groupId: string;
  isLoading?: boolean;
}

/**
 * Renders the group's event list in chronological order.
 */
export function EventsList({
  events,
  onAddEvent,
  onRsvp,
  onDeleteEvent,
  currentUser,
  isAdmin = false,
  groupId,
  isLoading = false,
}: EventsListProps) {
  const sortedEvents = sortEventsByDate(events);

  return (
    <div className="space-y-6">

      {isAdmin && currentUser && (
        <AddEventForm onSubmit={onAddEvent} isLoading={isLoading} />
      )}

      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {isAdmin
            ? "No events yet. Create one to get started!"
            : "No events yet. Check back soon!"}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event: any) => (
            <EventCard
              key={event.id}
              event={event}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onRsvp={onRsvp}
              onDelete={isAdmin ? onDeleteEvent : undefined}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
