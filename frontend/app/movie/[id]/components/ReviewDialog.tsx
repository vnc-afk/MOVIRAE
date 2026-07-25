
import { Star, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReviewDialogProps {
  isOpen: boolean;
  movieTitle: string;
  rating: number;
  comment: string;
  isSubmitting: boolean;
  isEditing: boolean;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isInFlight?: boolean;
}

/**
 * Modal dialog used to create or edit a movie review.
 * Disables submission while the form is in-flight or when the rating is missing.
 */
export function ReviewDialog({
  isOpen,
  movieTitle,
  rating,
  comment,
  isSubmitting,
  isEditing,
  onRatingChange,
  onCommentChange,
  onSubmit,
  onClose,
  isInFlight,
}: ReviewDialogProps) {
  const isDisabled = isSubmitting || !rating || isInFlight;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit your review" : "Write a review"}</DialogTitle>
          <DialogDescription>Share your rating and thoughts about {movieTitle}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Rating</p>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={rating >= value ? "default" : "secondary"}
                  size="icon"
                  onClick={() => onRatingChange(value)}
                  className="h-10 w-10"
                  aria-label={`Rate ${value} out of 5 stars`}
                  aria-pressed={rating >= value}
                >
                  <Star className={rating >= value ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Comment</p>
            <Textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="What did you think of the movie?"
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isDisabled}>
            {isSubmitting || isInFlight ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : isEditing ? (
              "Update Review"
            ) : (
              "Post Review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
