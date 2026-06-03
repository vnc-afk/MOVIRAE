import { memo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, MessageCircle, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupRecord } from "../lib/types";

interface GroupCardProps {
  group: GroupRecord;
  index: number;
  onJoinLeave: (groupId: string) => void;
  isMember?: boolean;
  isToggling?: boolean;
}

/**
 * GroupCard - Displays single group in grid
 *
 * Optimizations:
 * - Wrapped with React.memo to prevent unnecessary re-renders
 * - Custom comparison function only re-renders on meaningful changes
 * - useCallback for event handlers
 *
 * Responsibilities:
 * - Render group information
 * - Show member avatars
 * - Display shared movies
 * - Handle join/leave action
 * - Accessibility: proper ARIA labels and semantic HTML
 *
 * Props:
 * - group: Group data
 * - index: Animation delay index
 * - onJoinLeave: Callback when user clicks join/leave
 * - isMember: Whether current user is member
 * - isToggling: Whether membership update is in progress
 */
const GroupCardComponent = ({
  group,
  index,
  onJoinLeave,
  isMember = false,
  isToggling = false,
}: GroupCardProps) => {
  const handleJoinLeaveClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onJoinLeave(group.id);
    },
    [group.id, onJoinLeave]
  );

  // Calculate member count safely
  const memberCount = group.memberCount ?? (group.members?.length ?? 0);
  const sharedMoviesCount = group.sharedList?.length ?? 0;
  const visibleMembers = (group.members ?? []).slice(0, 3);
  const hiddenMembersCount = Math.max(0, memberCount - 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="rounded-xl bg-card p-6 card-shadow hover:card-shadow-hover transition-shadow duration-300 flex flex-col h-full"
    >
      <Link href={`/groups/${group.id}`} className="block flex-1">
        {/* Header with avatar */}
        <div className="flex items-start gap-4">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt=""
              className="h-14 w-14 rounded-xl bg-muted object-cover flex-shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div 
              className="h-14 w-14 rounded-xl bg-muted flex-shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2">
              {group.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {group.description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div 
          className="flex items-center gap-4 mt-4 text-xs text-muted-foreground"
          aria-label={`Group statistics: ${memberCount} members, ${sharedMoviesCount} films`}
        >
          <span className="flex items-center gap-1">
            <Users 
              className="h-3.5 w-3.5 flex-shrink-0" 
              aria-hidden="true"
            /> 
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          <span className="flex items-center gap-1">
            <Film 
              className="h-3.5 w-3.5 flex-shrink-0" 
              aria-hidden="true"
            /> 
            {sharedMoviesCount} {sharedMoviesCount === 1 ? "film" : "films"}
          </span>
        </div>

        {/* Member avatars */}
        {memberCount > 0 && (
          <div className="flex items-center mt-4" role="img" aria-label={`${Math.min(3, memberCount)} member avatars`}>
            <div className="flex -space-x-2">
              {visibleMembers.map((member, memberIndex) =>
                member.avatar ? (
                  <img
                    key={`${member.id}-${memberIndex}`}
                    src={member.avatar}
                    alt={member.displayName || "Group member"}
                    className="h-7 w-7 rounded-full border-2 border-card bg-muted object-cover flex-shrink-0"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    key={`${member.id}-${memberIndex}`}
                    className="h-7 w-7 rounded-full border-2 border-card bg-muted flex-shrink-0"
                    aria-hidden="true"
                  />
                )
              )}
            </div>
            {hiddenMembersCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                +{hiddenMembersCount} more
              </span>
            )}
          </div>
        )}

        {/* Shared movies preview */}
        {sharedMoviesCount > 0 && (
          <div 
            className="flex gap-2 mt-4"
            role="img"
            aria-label={`${Math.min(3, sharedMoviesCount)} shared movies`}
          >
            {(group.sharedList ?? []).slice(0, 3).map((movie, movieIndex) =>
              movie.poster ? (
                <img
                  key={`${movie.id}-${movieIndex}`}
                  src={movie.poster}
                  alt={movie.title || "Movie poster"}
                  className="h-16 w-11 rounded object-cover poster-shadow flex-shrink-0"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  key={`${movie.id}-${movieIndex}`}
                  className="h-16 w-11 rounded bg-muted poster-shadow flex-shrink-0"
                  aria-hidden="true"
                />
              )
            )}
          </div>
        )}
      </Link>

      {/* Action buttons */}
      <div className="flex gap-2 mt-5 pt-4 border-t border-border">
        <Button
          size="sm"
          variant={isMember ? "secondary" : "default"}
          className="flex-1 gap-1.5"
          onClick={handleJoinLeaveClick}
          disabled={isToggling}
          aria-label={isMember ? "Leave this group" : "Join this group"}
          aria-busy={isToggling}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {isToggling ? "..." : isMember ? "Joined" : "Join"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 gap-1.5"
          asChild
        >
          <Link 
            href={`/groups/${group.id}`}
            aria-label={`Discuss about ${group.name}`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Discuss
          </Link>
        </Button>
      </div>
    </motion.div>
  );
};

/**
 * Memoized component with custom comparison
 * Only re-renders if:
 * - group.id changes
 * - isMember changes
 * - group.memberCount changes
 * - isToggling changes
 */
export const GroupCard = memo(
  GroupCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.group.id === nextProps.group.id &&
      prevProps.isMember === nextProps.isMember &&
      prevProps.group.memberCount === nextProps.group.memberCount &&
      prevProps.isToggling === nextProps.isToggling &&
      prevProps.index === nextProps.index
    );
  }
);

GroupCard.displayName = "GroupCard";