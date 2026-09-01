"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Film, Loader2, Send } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SharedList } from "@/app/shared-lists/lib/types";
import { formatExactDate, formatRelativeDate, getSafeImageSrc } from "../lib/shared-lists-utils";

type SharedListComment = NonNullable<SharedList["commentItems"]>[number];

type CommentNodeProps = {
  comment: SharedListComment;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  onReplySubmit: (commentId: string) => void;
  isInFlight: (opId: string) => boolean;
};

export function CommentNode({
  comment,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  onReplySubmit,
  isInFlight,
}: CommentNodeProps) {
  const isReplying = openReplyFor === comment.id;
  const isReplySubmitting = isInFlight(`shared-list-reply-${comment.id}`);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={getSafeImageSrc(comment.user.avatar)} />
          <AvatarFallback>{comment.user.displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{comment.user.displayName}</span>
            <span className="text-muted-foreground" title={formatExactDate(comment.date)}>{formatRelativeDate(comment.date)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{comment.body}</p>

          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="text-foreground hover:text-primary" onClick={() => setOpenReplyFor(isReplying ? null : comment.id)}>
              Reply
            </button>
          </div>

          {isReplying && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyDrafts[comment.id] ?? ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                placeholder="Write a reply"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpenReplyFor(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => onReplySubmit(comment.id)} disabled={isReplySubmitting}>
                  {isReplySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post reply
                </Button>
              </div>
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l border-border pl-3">
              {comment.replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  openReplyFor={openReplyFor}
                  setOpenReplyFor={setOpenReplyFor}
                  onReplySubmit={onReplySubmit}
                  isInFlight={isInFlight}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
