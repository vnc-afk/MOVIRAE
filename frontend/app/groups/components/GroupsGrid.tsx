import { memo } from "react";
import { GroupCard } from "./GroupCard";
import type { GroupRecord } from "../lib/types";

interface GroupsGridProps {
  groups: GroupRecord[];
  onJoinLeave: (groupId: string) => void;
  currentUserId?: string;
  isToggling?: boolean;
}

/**
 * GroupsGrid - Renders grid of group cards
 *
 * Optimizations:
 * - Wrapped with memo to prevent re-renders when props haven't changed
 * - Passes isToggling state to individual cards
 *
 * Responsibilities:
 * - Display groups in responsive grid
 * - Pass props to each group card
 * - Handle join/leave actions
 * - Provide accessibility context
 *
 * Props:
 * - groups: Array of group records
 * - onJoinLeave: Callback for join/leave actions
 * - currentUserId: Current user ID to check membership
 * - isToggling: Whether any membership update is in progress
 */
const GroupsGridComponent = ({
  groups,
  onJoinLeave,
  currentUserId,
  isToggling = false,
}: GroupsGridProps) => {
  return (
    <section 
      className="space-y-4"
      aria-label={`${groups.length} available groups`}
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group, i) => (
          <GroupCard
            key={group.id}
            group={group}
            index={i}
            onJoinLeave={onJoinLeave}
            isMember={group.joined ?? false}
            isToggling={isToggling}
          />
        ))}
      </div>
    </section>
  );
};

/**
 * Memoized component
 * Re-renders only when groups array or callbacks change
 */
export const GroupsGrid = memo(GroupsGridComponent);

GroupsGrid.displayName = "GroupsGrid";