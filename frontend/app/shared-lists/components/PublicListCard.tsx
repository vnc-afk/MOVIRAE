"use client";

import { motion } from "framer-motion";
import { Film, Heart, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import type { SharedList } from "@/lib/types";
import { formatRelativeDate, getSafeImageSrc } from "../lib/shared-lists-utils";

type PublicListCardProps = {
  list: SharedList;
  index: number;
  isInFlight: (opId: string) => boolean;
  onLike: (list: SharedList) => void;
  onOpen: (id: string) => void;
  addingMovieToListId: string | null;
  removingMovieFromListId: string | null;
};

export function PublicListCard({ list, index, isInFlight, onLike, onOpen, addingMovieToListId, removingMovieFromListId }: PublicListCardProps) {
  const vis = {
    public: { icon: Film, label: "Public", color: "text-green-500" },
    private: { icon: Film, label: "Private", color: "text-amber-500" },
    group: { icon: Film, label: "Group", color: "text-blue-500" },
  }[list.visibility] ?? { icon: Film, label: "Public", color: "text-green-500" };
  const VisIcon = vis.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-all duration-300"
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
      </div>

      <div className="flex gap-2 mt-4 overflow-hidden relative">
        {(addingMovieToListId === list.id || removingMovieFromListId === list.id) && (
          <div className="absolute -top-2 right-3 z-20">
            <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[10px] font-medium border ${addingMovieToListId === list.id ? "border-primary/30 bg-primary/10 text-primary animate-pulse" : "border-destructive/30 bg-destructive/10 text-destructive animate-pulse"}`}>
              <Loader2 className="h-3 w-3" /> {addingMovieToListId === list.id ? "adding" : "removing"}
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
