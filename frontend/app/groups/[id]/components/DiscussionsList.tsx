"use client";

import { Button } from "@/components/ui/button";
import { DiscussionItem } from "./DiscussionItem";
import { AddDiscussionForm } from "./AddDiscussionForm";
import type { Discussion, DiscussionSortType } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

interface DiscussionsListProps {
  discussions: Discussion[];
  sortType: DiscussionSortType;
  onSortChange: (sortType: DiscussionSortType) => void;
  onAddDiscussion: (title: string, body: string, movieId?: string) => Promise<void>;
  onLikeDiscussion: (discussionId: string) => Promise<void>;
  onAddReply: (discussionId: string, body: string) => Promise<void>;
  currentUser: UserProfile | null;
  groupId: string;
  isLoading?: boolean;
}

/**
 * DiscussionsList - Manages discussions tab with sorting and form
 *
 * Responsibilities:
 * - Display sort buttons
 * - Show add discussion form
 * - Render sorted discussions
 * - Handle discussion interactions
 *
 * Props:
 * - discussions: List of discussions
 * - sortType: Current sort type
 * - onSortChange: Sort change callback
 * - onAddDiscussion: Add discussion callback
 * - onLikeDiscussion: Like discussion callback
 * - onAddReply: Add reply callback
 * - currentUser: Current user
 * - groupId: Group ID
 * - isLoading: Whether loading
 */
export function DiscussionsList({
  discussions,
  sortType,
  onSortChange,
  onAddDiscussion,
  onLikeDiscussion,
  onAddReply,
  currentUser,
  groupId,
  isLoading = false,
}: DiscussionsListProps) {
  return (
    <div className="space-y-6">
      {/* Sort controls */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 card-shadow">
        <p className="text-xs text-muted-foreground">Sort discussions</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={sortType === "latest" ? "default" : "secondary"}
            className="h-7 px-3 text-xs"
            onClick={() => onSortChange("latest")}
          >
            Latest
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sortType === "popular" ? "default" : "secondary"}
            className="h-7 px-3 text-xs"
            onClick={() => onSortChange("popular")}
          >
            Popular
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sortType === "oldest" ? "default" : "secondary"}
            className="h-7 px-3 text-xs"
            onClick={() => onSortChange("oldest")}
          >
            Oldest
          </Button>
        </div>
      </div>

      {/* Add discussion form */}
      {currentUser && (
        <AddDiscussionForm
          onSubmit={onAddDiscussion}
          currentUser={currentUser}
          isLoading={isLoading}
        />
      )}

      {/* Discussions list */}
      {discussions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No discussions yet. Start one to get the conversation going!
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((discussion) => (
            <DiscussionItem
              key={discussion.id}
              discussion={discussion}
              currentUser={currentUser}
              onLike={onLikeDiscussion}
              onReply={onAddReply}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
