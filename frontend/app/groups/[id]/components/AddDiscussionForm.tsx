"use client";

import { useCallback, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { UserProfile } from "@/lib/types";

/**
 * Props for the discussion composer.
 */
interface AddDiscussionFormProps {
  onSubmit: (title: string, body: string, movieId?: string) => Promise<void>;
  currentUser: UserProfile;
  isLoading?: boolean;
}

/**
 * Lets the current user create a discussion post for the group.
 */
export function AddDiscussionForm({
  onSubmit,
  currentUser,
  isLoading = false,
}: AddDiscussionFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    // Require both a title and body before sending a new discussion.
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(title, body);
      setTitle("");
      setBody("");
      toast.success("Discussion posted!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to post discussion";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, body, onSubmit]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {currentUser.avatar ? (
          <img
            src={currentUser.avatar}
            alt={currentUser.displayName}
            className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-3">
          <Input
            placeholder="Discussion title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting || isLoading}
          />
          <Textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            disabled={isSubmitting || isLoading}
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!title.trim() || !body.trim() || isSubmitting || isLoading}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
