"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GroupEventRecord } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

interface EventCardProps {
  event: GroupEventRecord;
  currentUser: UserProfile | null;
  isAdmin?: boolean;
  onRsvp: (eventId: string, status: "yes" | "no" | "maybe") => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * EventCard - Single event with RSVP and attendance info
 *
 * Responsibilities:
 * - Display event details (title, date, time, location)
 * - Show attendee avatars
 * - Handle RSVP actions
 * - Allow deletion for admins
 *
 * Props:
 * - event: Event data
 * - currentUser: Current user
 * - isAdmin: Whether user is admin
 * - onRsvp: RSVP callback
 * - onDelete: Delete callback
 * - isLoading: Whether loading
 */
export function EventCard({
  event,
  currentUser,
  isAdmin = false,
  onRsvp,
  onDelete,
  isLoading = false,
}: EventCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRsvp = event.attendees?.find(
    (attendee) => attendee.user?.id === currentUser?.id
  )?.rsvpStatus;

  const rsvpCounts = {
    yes: event.attendees?.filter((a) => a.rsvpStatus === "yes").length || 0,
    no: event.attendees?.filter((a) => a.rsvpStatus === "no").length || 0,
    maybe: event.attendees?.filter((a) => a.rsvpStatus === "maybe").length || 0,
  };

  const handleRsvp = useCallback(
    async (status: "yes" | "no" | "maybe") => {
      setIsSubmitting(true);
      try {
        await onRsvp(event.id, status);
      } catch (err) {
        console.error("Failed to RSVP:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [event.id, onRsvp]
  );

  const handleDelete = useCallback(async () => {
    if (!onDelete || !window.confirm("Delete this event?")) return;

    setIsSubmitting(true);
    try {
      await onDelete(event.id);
    } catch (err) {
      console.error("Failed to delete event:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [event.id, onDelete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">{event.title}</h3>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {event.description}
            </p>
          )}
        </div>
        {isAdmin && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={handleDelete}
            disabled={isSubmitting || isLoading}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(`${event.startDate}T${event.startTime}`), "MMM d")} at{" "}
          {format(new Date(`${event.startDate}T${event.startTime}`), "h:mm a")}
        </span>
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        )}
      </div>

      {/* Creator info */}
      {event.creator && (
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          {event.creator.avatar ? (
            <img
              src={event.creator.avatar}
              alt={event.creator.displayName ?? "Creator"}
              className="h-5 w-5 rounded-full bg-muted"
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-muted" />
          )}
          <span>Created by {event.creator.displayName}</span>
        </div>
      )}

      {/* Attendees */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        <Badge variant="outline" className="gap-1.5">
          <Users className="h-3 w-3" />
          {rsvpCounts.yes} going
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          Maybe: {rsvpCounts.maybe}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          Can't go: {rsvpCounts.no}
        </Badge>
      </div>

      {/* RSVP buttons */}
      {currentUser && (
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant={userRsvp === "yes" ? "default" : "outline"}
            onClick={() => handleRsvp("yes")}
            disabled={isSubmitting || isLoading}
            className="flex-1"
          >
            {isSubmitting && userRsvp !== "yes" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Going"
            )}
          </Button>
          <Button
            size="sm"
            variant={userRsvp === "maybe" ? "default" : "outline"}
            onClick={() => handleRsvp("maybe")}
            disabled={isSubmitting || isLoading}
            className="flex-1"
          >
            Maybe
          </Button>
          <Button
            size="sm"
            variant={userRsvp === "no" ? "default" : "outline"}
            onClick={() => handleRsvp("no")}
            disabled={isSubmitting || isLoading}
            className="flex-1"
          >
            Can't go
          </Button>
        </div>
      )}
    </motion.div>
  );
}
