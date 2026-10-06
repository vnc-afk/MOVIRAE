
import { Eye, Heart, ListPlus, Play, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Controls available movie actions shown on the detail page.
 * Includes trailer playback, watched/watchlist/favorite toggles, and review entry.
 */
interface MovieActionsProps {
  movieId: string;
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
  initializing: boolean;
  loading: { watched: boolean; watchlist: boolean; liked: boolean };
  isAuthenticated: boolean;
  hasCurrentReview: boolean;
  onToggleWatched: () => void;
  onToggleWatchlist: () => void;
  onToggleLiked: () => void;
  onPlayTrailer: () => void;
  onReview: () => void;
}

export function MovieActions({
  isWatched,
  isWatchlist,
  isLiked,
  initializing,
  loading,
  isAuthenticated,
  hasCurrentReview,
  onToggleWatched,
  onToggleWatchlist,
  onToggleLiked,
  onPlayTrailer,
  onReview,
}: MovieActionsProps) {
  return (
    <div className="flex flex-wrap gap-3 mt-6">
      <Button onClick={onPlayTrailer} className="gap-2">
        <Play className="h-4 w-4" /> Watch Trailer
      </Button>

      <Button
        variant="secondary"
        className={`gap-2 ${isWatched ? "bg-primary text-primary-foreground" : ""}`}
        onClick={onToggleWatched}
        disabled={loading.watched || initializing}
      >
        <Eye className="h-4 w-4" />
        {loading.watched || initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : isWatched ? "Watched" : "Mark Watched"}
      </Button>

      <Button
        variant="secondary"
        className={`gap-2 ${isWatchlist ? "bg-primary text-primary-foreground" : ""}`}
        onClick={onToggleWatchlist}
        disabled={loading.watchlist || initializing}
      >
        <ListPlus className="h-4 w-4" />
        {loading.watchlist || initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : isWatchlist ? "In Watchlist" : "Watchlist"}
      </Button>

      <Button
        variant="secondary"
        className={`gap-2 ${isLiked ? "bg-primary text-primary-foreground" : ""}`}
        onClick={onToggleLiked}
        disabled={loading.liked || initializing}
      >
        <Heart className="h-4 w-4" />
        {loading.liked || initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : isLiked ? "Liked" : "Like"}
      </Button>

      <Button
        variant="secondary"
        className="gap-2"
        onClick={onReview}
        disabled={(isAuthenticated && !isWatched && !hasCurrentReview) || initializing}
      >
        <Star className="h-4 w-4" /> {hasCurrentReview ? "Edit Review" : "Write Review"}
      </Button>
    </div>
  );
}
