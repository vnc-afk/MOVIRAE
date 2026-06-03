"use client";

import { motion } from "framer-motion";
import type { UserProfile } from "@/lib/types";

interface MembersTabProps {
  members: UserProfile[];
  creatorId?: string;
  currentUserId?: string;
}

/**
 * MembersTab - Displays group members
 *
 * Responsibilities:
 * - Show list of group members
 * - Highlight group creator
 * - Display member profiles
 *
 * Props:
 * - members: List of group members
 * - creatorId: ID of group creator
 * - currentUserId: Current user ID
 */
export function MembersTab({
  members,
  creatorId,
  currentUserId,
}: MembersTabProps) {
  return (
    <div className="space-y-6">
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No members in this group.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.displayName}
                    className="h-10 w-10 rounded-full bg-muted"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{member.displayName}</p>
                  {member.username && (
                    <p className="text-xs text-muted-foreground">
                      @{member.username}
                    </p>
                  )}
                </div>
                {member.id === creatorId && (
                  <div className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                    Creator
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
