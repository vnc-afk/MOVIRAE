"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDiscussionDate } from "../../lib/groupUtils";
import type { Discussion, DiscussionReply } from "../../lib/types";
import type { UserProfile } from "@/lib/types";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";

interface DiscussionItemProps {
  discussion: Discussion;
  currentUser: UserProfile | null;
  onLike: (discussionId: string) => Promise<void>;
  onReply: (discussionId: string, body: string) => Promise<void>;
  isLoading?: boolean;
}

export function DiscussionItem({
  discussion,
  currentUser,
  onLike,
  onReply,
  isLoading = false,
}: DiscussionItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movies, setMovies] = useState<Array<{ id: string; title: string; poster?: string; year?: number }>>([]);

  useEffect(() => {
    const movieIds = discussion.movieIds?.length ? discussion.movieIds : discussion.movieId ? [discussion.movieId] : [];
    if (movieIds.length === 0) return;
    let active = true;
    Promise.all(movieIds.map((movieId) =>
      fetch(`/api/tmdb/movie/${movieId}`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => payload?.value ?? payload)
        .catch(() => null)
    )).then((results) => {
      if (active) setMovies(results.filter((movie) => movie?.id));
    });
    return () => { active = false; };
  }, [discussion.movieId, discussion.movieIds]);

  const handleLike = useCallback(async () => {
    try {
      await onLike(discussion.id);
    } catch (err) {
      console.error("Failed to like discussion:", err);
    }
  }, [discussion.id, onLike]);

  const handleReplySubmit = useCallback(async () => {
    if (!replyBody.trim()) return;

    setIsSubmitting(true);
    try {
      await onReply(discussion.id, replyBody);
      setReplyBody("");
      setShowReplyForm(false);
    } catch (err) {
      console.error("Failed to add reply:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [replyBody, discussion.id, onReply]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {discussion.author.avatar ? (
            <img
              src={discussion.author.avatar}
              alt={discussion.author.displayName}
              className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {discussion.author.displayName}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDiscussionDate(discussion.date)}
              </span>
            </div>
            <h3 className="text-base font-semibold mt-1">{discussion.title}</h3>
          </div>
        </div>
      </div>

      
      <p className="text-sm text-foreground mt-3 ml-11">{discussion.body}</p>

      {(discussion.movieIds?.length ?? 0) > 0 || discussion.movieId ? (
        <div className="mt-3 ml-11 flex flex-wrap gap-2">
          {movies.length > 0 ? movies.map((movie) => (
            <MoviePrefetchLink key={movie.id} movieId={movie.id} href={`/movie/${movie.id}`} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-secondary/50 p-2 hover:bg-secondary">
              {movie.poster ? <img src={movie.poster} alt="" className="h-14 w-10 rounded object-cover" /> : <div className="flex h-14 w-10 items-center justify-center rounded bg-muted"><Film className="h-4 w-4 text-muted-foreground" /></div>}
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Attached movie</p>
                <p className="max-w-40 truncate text-sm font-medium">{movie.title}</p>
                {movie.year ? <p className="text-xs text-muted-foreground">{movie.year}</p> : null}
              </div>
            </MoviePrefetchLink>
          )) : <p className="text-xs text-muted-foreground">Loading attached movies...</p>}
        </div>
      ) : null}

      <div className="flex items-center gap-3 mt-4 ml-11">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs h-7"
          onClick={handleLike}
          disabled={isLoading}
        >
          <Heart
            className={`h-3.5 w-3.5 ${
              discussion.likedByMe ? "fill-red-500 text-red-500" : ""
            }`}
          />
          {discussion.likes}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs h-7"
          onClick={() => setShowReplyForm(!showReplyForm)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {discussion.replies}
        </Button>
      </div>

      {showReplyForm && (
        <div className="mt-4 ml-11 space-y-3">
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleReplySubmit}
              disabled={!replyBody.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Posting...
                </>
              ) : (
                "Reply"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowReplyForm(false);
                setReplyBody("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(discussion.replyItems?.length ?? 0) > 0 && (
        <AnimatePresence>
          <div className="mt-4 ml-11 space-y-3 border-t border-border pt-3">
            {discussion.replyItems?.map((reply) => (
              <motion.div
                key={reply.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 text-sm"
              >
                {reply.author.avatar ? (
                  <img
                    src={reply.author.avatar}
                    alt={reply.author.displayName}
                    className="h-6 w-6 rounded-full bg-muted flex-shrink-0"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-xs">
                      {reply.author.displayName}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDiscussionDate(reply.date)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{reply.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}
