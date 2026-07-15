import { memo } from "react";
import { GroupCard } from "./GroupCard";
import type { GroupRecord } from "../lib/types";

/**
 * Props for the groups grid container.
 */
interface GroupsGridProps {
  groups: GroupRecord[];
  onJoinLeave: (groupId: string) => void;
  currentUserId?: string;
  isToggling?: boolean;
}

/**
 * Renders the list of group cards in a responsive grid.
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

export const GroupsGrid = memo(GroupsGridComponent);

GroupsGrid.displayName = "GroupsGrid";