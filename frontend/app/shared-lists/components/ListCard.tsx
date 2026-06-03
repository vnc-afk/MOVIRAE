"use client";

import { motion } from "framer-motion";
import { Film, Heart, MessageCircle, MoreHorizontal, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import type { SharedList, UserProfile } from "@/lib/types";
import { formatRelativeDate, getSafeImageSrc } from "../lib/shared-lists-utils";

type ListCardProps = {
  list: SharedList;
  index: number;
  currentUser: UserProfile | null;
  isInFlight: (opId: string) => boolean;
  onLike: (list: SharedList) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  addingMovieToListId: string | null;
  removingMovieFromListId: string | null;
};

export function ListCard({ list, index, currentUser, isInFlight, onLike, onDelete, onOpen, addingMovieToListId, removingMovieFromListId }: ListCardProps) {
  const vis = {
    public: { icon: Film, label: "Public", color: "text-green-500" },
    private: { icon: Film, label: "Private", color: "text-amber-500" },
    group: { icon: Film, label: "Group", color: "text-blue-500" },
  }[list.visibility] ?? { icon: Film, label: "Public", color: "text-green-500" };
  const VisIcon = vis.icon;
  const isOwner = currentUser?.id === list.owner.id;
  const isCollaborator = currentUser ? list.collaborators.some((c) => c.id === currentUser.id) : false;
  const canEdit = isOwner || isCollaborator;
  const isDeleting = isInFlight(`shared-list-delete-${list.id}`);
  const adding = addingMovieToListId === list.id;
  const removing = removingMovieFromListId === list.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-all duration-300 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{list.name}</h3>
            <Badge variant="outline" className={`text-[10px] gap-1 ${vis.color}`}>
              <VisIcon className="h-2.5 w-2.5" /> {vis.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
        </div>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Invite Collaborator</DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onOpen(list.id)}><Film className="h-3.5 w-3.5" /> Add Movie</DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(list.id)} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete List
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="flex gap-2 mt-4 overflow-hidden relative">
        {(adding || removing) && (
          <div className="absolute -top-2 right-3 z-20">
            <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-medium border ${adding ? "border-primary/30 bg-primary/10 text-primary animate-pulse" : "border-destructive/30 bg-destructive/10 text-destructive animate-pulse"}`}>
              <Loader2 className="h-3 w-3" /> {adding ? "adding" : "removing"}
            </span>
          </div>
        )}
        {list.movies.slice(0, 5).map((movie) => (
          <MoviePrefetchLink key={movie.id} movieId={movie.id} href={`/movie/${movie.id}`} className="flex-1 min-w-0">
            <img
              src={getSafeImageSrc(movie.poster) || ""}
              alt={movie.title}
              className="h-20 w-full rounded-md object-cover poster-shadow hover:scale-105 transition-transform duration-200"
            />
          </MoviePrefetchLink>
        ))}
        {list.movies.length > 5 && (
          <div className="flex-1 min-w-0 h-20 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{list.movies.length - 5}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
            <AvatarFallback>{list.owner.displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{list.owner.displayName}</span>
          {list.collaborators.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">+</span>
              <div className="flex -space-x-1.5">
                {list.collaborators.slice(0, 3).map((c) => (
                  <Avatar key={c.id} className="h-5 w-5 border border-card">
                    <AvatarImage src={getSafeImageSrc(c.avatar)} />
                    <AvatarFallback className="text-[8px]">{c.displayName[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{formatRelativeDate(list.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {list.movies.length} films</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {list.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {list.comments}</span>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const likeInFlight = isInFlight(`shared-list-like-${list.id}`);
            const isLiked = Boolean(list.likedByMe);
            return (
              <Button
                size="sm"
                variant="ghost"
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  isLiked ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                } ${likeInFlight ? "border-primary/40 bg-primary/10 text-primary" : ""}`}
                onClick={() => onLike(list)}
                disabled={likeInFlight}
                aria-busy={likeInFlight}
              >
                {likeInFlight ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={`h-3 w-3 ${isLiked ? "fill-primary text-primary" : ""}`} />} {list.likedByMe ? "Liked" : "Like"}
              </Button>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onOpen(list.id)}
          >
            View
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
