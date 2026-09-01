"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import { Film, Heart, MessageCircle, Loader2, Send, Users, MessageSquareReply } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SharedList } from "@/app/shared-lists/lib/types";
import type { UserProfile } from "@/lib/types";
import type { Group } from "@/app/groups/lib/types";
import { formatExactDate, formatRelativeDate, getSafeImageSrc } from "../lib/shared-lists-utils";
import { CommentNode } from "./CommentNode";

export type PublicListDetailProps = {
  list: SharedList;
  groups: Group[];
  currentUser: UserProfile | null;
  commentCount: number;
  newComment: string;
  setNewComment: (value: string) => void;
  onCommentSubmit: () => void;
  isInFlight: (opId: string) => boolean;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  onReplySubmit: (commentId: string) => void;
  onLike: () => void;
};

export function PublicListDetail({
  list,
  groups,
  currentUser,
  commentCount,
  newComment,
  setNewComment,
  onCommentSubmit,
  isInFlight,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  onReplySubmit,
  onLike,
}: PublicListDetailProps) {
  const config = {
    public: { icon: Film, label: "Public", color: "text-green-500" },
    private: { icon: Film, label: "Private", color: "text-amber-500" },
    group: { icon: Film, label: "Group", color: "text-blue-500" },
  }[list.visibility] ?? { icon: Film, label: "Public", color: "text-green-500" };
  const VisibilityIcon = config.icon;
  const groupName = list.groupName ?? (list.groupId ? groups.find((item) => item.id === list.groupId)?.name ?? null : null);
  const commentItems = list.commentItems ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <VisibilityIcon className={`h-3.5 w-3.5 ${config.color}`} />
            {config.label}
            {groupName && <Badge variant="outline">{groupName}</Badge>}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">{list.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{list.description}</p>
        </div>

        <div className="flex gap-2">
          {(() => {
            const isLiked = Boolean(list.likedByMe);
            return (
              <Button variant="outline" size="sm" onClick={onLike} className={`gap-2 inline-flex items-center ${isLiked ? "border-primary/40 bg-primary/10 text-primary" : ""}`} disabled={isInFlight(`shared-list-like-${list.id}`)}>
                <Heart className={`h-4 w-4 ${isLiked ? "fill-primary text-primary" : ""}`} />
                {list.likes}
              </Button>
            );
          })()}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
          <AvatarFallback>{list.owner.displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">by {list.owner.displayName}</p>
          <p className="text-xs text-muted-foreground" title={formatExactDate(list.createdAt)}>{formatRelativeDate(list.createdAt)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {list.collaborators.length + 1} members
          <span className="hidden sm:inline">•</span>
          <MessageCircle className="h-3.5 w-3.5" /> {commentCount} replies
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Film className="h-4 w-4" /> Movies
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.movies.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No movies in this list yet.
            </div>
          ) : (
            list.movies.map((movie) => (
              <div key={movie.id} className="relative group rounded-lg overflow-hidden border border-border bg-card">
                <MoviePrefetchLink movieId={movie.id} href={`/movie/${movie.id}`} className="block">
                  {getSafeImageSrc(movie.poster) ? (
                    <img
                      src={getSafeImageSrc(movie.poster)}
                      alt={movie.title}
                      className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">Open movie page</p>
                  </div>
                </MoviePrefetchLink>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquareReply className="h-4 w-4" /> Comments
        </div>

        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder={currentUser ? "Write a comment to start the conversation" : "Sign in to comment"}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={onCommentSubmit} className="gap-2" disabled={!currentUser || isInFlight(`shared-list-comment-${list.id}`)}>
              {isInFlight(`shared-list-comment-${list.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post comment
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {commentItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No comments yet.
            </div>
          )}

          {commentItems.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              openReplyFor={openReplyFor}
              setOpenReplyFor={setOpenReplyFor}
              onReplySubmit={onReplySubmit}
              isInFlight={isInFlight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
