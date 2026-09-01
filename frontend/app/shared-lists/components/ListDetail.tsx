"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import { Film, Heart, MessageCircle, Loader2, Search, Send, Trash2, Users, MessageSquareReply } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SharedList } from "@/app/shared-lists/lib/types";
import type { Movie, UserProfile } from "@/lib/types";
import type { Group } from "@/app/groups/lib/types";
import { formatExactDate, formatRelativeDate, getSafeImageSrc } from "../lib/shared-lists-utils";
import { CommentNode } from "./CommentNode";

export type ListDetailProps = {
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
  movieSearchQuery: string;
  setMovieSearchQuery: (value: string) => void;
  movieSearchResults: Movie[];
  movieSearchLoading: boolean;
  movieSearchError: string | null;
  onAddMovie: (listId: string, movieId: string) => void;
  addingMovieToListId: string | null;
  removingMovieFromListId: string | null;
  onRemoveMovie: (listId: string, movieId: string) => void;
  onLike: () => void;
  onDelete: () => void;
};

export function ListDetail({
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
  movieSearchQuery,
  setMovieSearchQuery,
  movieSearchResults,
  movieSearchLoading,
  movieSearchError,
  onAddMovie,
  addingMovieToListId,
  removingMovieFromListId,
  onRemoveMovie,
  onLike,
  onDelete,
}: ListDetailProps) {
  // `ListDetail` is a client-rendered component that shows the full details of a shared list.
  // Important UI concerns:
  // - Permission checks (`canEdit`) gate movie add/remove and delete actions.
  // - Optimistic in-flight indicators rely on `isInFlight(opId)` passed from hooks.
  // - Replies/comments are rendered via `CommentNode` which handles nested replies.

  const config = {
    public: { icon: Film, label: "Public", color: "text-green-500" },
    private: { icon: Film, label: "Private", color: "text-amber-500" },
    group: { icon: Film, label: "Group", color: "text-blue-500" },
  }[list.visibility] ?? { icon: Film, label: "Public", color: "text-green-500" };
  const VisibilityIcon = config.icon;
  const groupName = list.groupName ?? (list.groupId ? groups.find((item) => item.id === list.groupId)?.name ?? null : null);
  const commentItems = list.commentItems ?? [];
  const isOwner = currentUser?.id === list.owner.id;
  const isCollaborator = currentUser ? list.collaborators.some((collaborator) => collaborator.id === currentUser.id) : false;
  const canEdit = isOwner || isCollaborator;
  const isDeleting = isInFlight(`shared-list-delete-${list.id}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
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
            <Button variant="outline" size="sm" onClick={onLike} className="gap-2">
              <Heart className={`h-4 w-4 ${list.likedByMe ? "fill-primary text-primary" : ""}`} />
              {list.likes}
            </Button>
            {isOwner && (
              <Button variant="destructive" size="sm" onClick={onDelete} className="gap-2" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </Button>
            )}
          </div>
        </div>

        {/* Header: owner, visibility, and counts */}
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

        {/* Movies section: list of movie posters and controls to add/remove for editors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Film className="h-4 w-4" /> Movies
            {addingMovieToListId === list.id && (
              <span className="ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-medium border border-primary/30 bg-primary/10 text-primary animate-pulse">
                <Loader2 className="h-3 w-3" /> adding
              </span>
            )}
            {removingMovieFromListId === list.id && (
              <span className="ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-medium border border-destructive/30 bg-destructive/10 text-destructive animate-pulse">
                <Loader2 className="h-3 w-3" /> removing
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {list.movies.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No movies yet. Use the add movie search on the right.
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
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemoveMovie(list.id, movie.id);
                      }}
                      disabled={removingMovieFromListId === list.id}
                      className="absolute right-3 top-3 z-10 rounded-full border border-border bg-background/90 p-1 text-destructive shadow hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Comments section: textarea + existing comments rendered via CommentNode */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareReply className="h-4 w-4" /> Comments
            {isInFlight(`shared-list-comment-${list.id}`) && (
              <span className="ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-medium border border-primary/30 bg-primary/10 text-primary animate-pulse">
                <Loader2 className="h-3 w-3" /> posting
              </span>
            )}
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

      {/* Right column: add movie UI (only visible to editors) */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Film className="h-4 w-4" /> Add movie
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Search TMDb and add a movie straight to this list.</p>
        </div>

        {canEdit ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={movieSearchQuery}
                onChange={(event) => setMovieSearchQuery(event.target.value)}
                placeholder="Search for a movie"
                className="pl-9"
              />
            </div>

            {movieSearchLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching TMDb...
              </div>
            )}

            {movieSearchError && <p className="text-xs text-destructive">{movieSearchError}</p>}

            <div className="space-y-2">
              {movieSearchResults.map((movie) => (
                <div key={movie.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  {getSafeImageSrc(movie.poster) ? (
                    <img src={getSafeImageSrc(movie.poster)} alt={movie.title} className="h-16 w-12 rounded object-cover bg-muted" />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Film className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">{movie.year} • {movie.genre}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddMovie(list.id, movie.id)}
                    disabled={addingMovieToListId === list.id}
                  >
                    {addingMovieToListId === list.id ? "Adding..." : "Add"}
                  </Button>
                </div>
              ))}

              {!movieSearchLoading && movieSearchQuery.trim().length >= 2 && movieSearchResults.length === 0 && !movieSearchError && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                  No movie matches found.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Only the list owner or collaborators can add and remove movies from this list.
          </div>
        )}
      </div>
    </div>
  );
}
