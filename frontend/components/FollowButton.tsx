"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  onFollowingChange?: (isFollowing: boolean) => void;
  className?: string;
  size?: ButtonProps["size"];
}

export function FollowButton({
  userId,
  initialFollowing = false,
  onFollowingChange,
  className,
  size = "sm",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggleFollow = async () => {
    if (isPending) return;

    const nextFollowing = !isFollowing;
    const method = nextFollowing ? "POST" : "DELETE";

    setIsPending(true);
    setIsFollowing(nextFollowing);

    try {
      const response = await fetch(`/api/users/${userId}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update follow state");
      }

      const serverFollowing = Boolean(payload?.value?.isFollowing);
      setIsFollowing(serverFollowing);
      onFollowingChange?.(serverFollowing);
      toast.success(serverFollowing ? "Following user" : "Unfollowed user");
    } catch (error) {
      setIsFollowing(!nextFollowing);
      toast.error(error instanceof Error ? error.message : "Failed to update follow state");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={isFollowing ? "secondary" : "default"}
      onClick={toggleFollow}
      disabled={isPending}
      className={cn("gap-1.5", className)}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}