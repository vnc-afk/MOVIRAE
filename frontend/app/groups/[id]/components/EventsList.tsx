"use client";

import { EventCard } from "./EventCard";
import { AddEventForm } from "./AddEventForm";
import { sortEventsByDate } from "../../lib/groupUtils";
import type { GroupEventRecord } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

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
 * EventsList - Manages events with sorting and creation
 *
 * Responsibilities:
 * - Display add event form (for admins)
 * - Show events sorted by date
 * - Handle RSVP actions
 * - Handle event deletion (for admins)
 *
 * Props:
 * - events: List of events
 * - onAddEvent: Add event callback
 * - onRsvp: RSVP callback
 * - onDeleteEvent: Delete event callback
 * - currentUser: Current user
 * - isAdmin: Whether user is admin
 * - groupId: Group ID
 * - isLoading: Whether loading
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
      {/* Add event form (admin only) */}
      {isAdmin && currentUser && (
        <AddEventForm onSubmit={onAddEvent} isLoading={isLoading} />
      )}

      {/* Events list */}
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
