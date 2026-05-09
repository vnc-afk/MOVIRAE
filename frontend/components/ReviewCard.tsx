"use client";

import { useState } from "react";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { StarRating } from "./StarRating";
import type { Review } from "@/data/mockData";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div className="rounded-lg bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow duration-300">
      <div className="flex items-start gap-3">
        <img
          src={review.user.avatar}
          alt={review.user.displayName}
          className="h-10 w-10 rounded-full bg-muted"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm text-foreground">
                {review.user.displayName}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {review.date}
              </span>
            </div>
            <StarRating rating={review.rating} size="sm" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {review.comment}
          </p>

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary" : ""}`} />
              <span>{review.likes + (liked ? 1 : 0)}</span>
            </button>
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
            {review.replies && review.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {review.replies.length} {review.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
              />
              <button className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Threaded replies */}
          {showReplies && review.replies && (
            <div className="mt-4 ml-4 border-l-2 border-border pl-4 space-y-3">
              {review.replies.map((reply) => (
                <div key={reply.id} className="flex gap-2">
                  <img
                    src={reply.user.avatar}
                    alt={reply.user.displayName}
                    className="h-7 w-7 rounded-full bg-muted flex-shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {reply.user.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {reply.date}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {reply.comment}
                    </p>
                    <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1">
                      <Heart className="h-3 w-3" />
                      <span>{reply.likes}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
