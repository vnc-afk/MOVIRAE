"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus, Calendar, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddEventFormProps {
  onSubmit: (
    title: string,
    startDate: string,
    startTime: string,
    description?: string
  ) => Promise<void>;
  isLoading?: boolean;
}

/**
 * AddEventForm - Dialog form to create new event
 *
 * Responsibilities:
 * - Collect event details (title, date, time, location, description)
 * - Validate input
 * - Handle form submission
 * - Manage dialog state
 *
 * Props:
 * - onSubmit: Submit callback
 * - isLoading: Whether loading
 */
export function AddEventForm({
  onSubmit,
  isLoading = false,
}: AddEventFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !startDate || !startTime) {
      toast.error("Title, date, and time are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(title, startDate, startTime, description);
      setTitle("");
      setStartDate("");
      setStartTime("");
      setDescription("");
      setOpen(false);
      toast.success("Event created!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create event";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, startDate, startTime, description, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new event</DialogTitle>
          <DialogDescription>
            Add the title, date, time, and optional details for a group event.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="e-title">Event title</Label>
            <Input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the event?"
              disabled={isSubmitting || isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting || isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-time">Time</Label>
              <Input
                id="e-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-desc">Description (optional)</Label>
            <Textarea
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details..."
              rows={3}
              disabled={isSubmitting || isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !title.trim() || !startDate || !startTime || isSubmitting || isLoading
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Creating...
              </>
            ) : (
              "Create Event"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
