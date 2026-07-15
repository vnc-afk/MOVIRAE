"use client";

import Link from "next/link";
import { ArrowLeft, Users, Film, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from "lucide-react";
import type { GroupDetailRecord } from "../../lib/types";
import type { UserProfile } from "@/lib/types";

/**
 * Props for the group detail header.
 */
interface GroupDetailHeaderProps {
  group: GroupDetailRecord;
  isJoined: boolean;
  onJoinLeave: () => Promise<void>;
  currentUser: UserProfile | null;
  discussionCount: number;
}

/**
 * Displays the group's hero content and primary membership action.
 */
export function GroupDetailHeader({
  group,
  isJoined,
  onJoinLeave,
  currentUser,
  discussionCount,
}: GroupDetailHeaderProps) {
  return (
    <div className="relative border-b bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="container py-8">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All groups
        </Link>

        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name}
              className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20"
            />
          ) : (
            <div className="h-24 w-24 rounded-2xl bg-muted ring-2 ring-primary/20" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-bold text-foreground">
              {group.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {group.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {group.memberCount || 0}{" "}
                members
              </span>
              <span className="flex items-center gap-1">
                <Film className="h-3.5 w-3.5" /> {group.sharedList?.length || 0}{" "}
                shared films
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> {discussionCount}{" "}
                discussions
              </span>
            </div>
          </div>
          <Button
            onClick={onJoinLeave}
            variant={isJoined ? "secondary" : "default"}
            className="gap-2"
          >
            {isJoined ? (
              <>
                <UserMinus className="h-4 w-4" /> Leave Group
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Join Group
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
