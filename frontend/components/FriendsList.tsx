"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { fetchFriends, fetchMessageThread } from "@/lib/messaging";
import { safePrefetchQuery } from "@/lib/prefetchHelpers";
import type { UserProfile } from "@/lib/types";

type FriendsListProps = {
  onMessage?: (friendId: string) => void;
};

export function FriendsList({ onMessage }: FriendsListProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const friendsQuery = usePrefetchAwareQuery<UserProfile[]>({
    queryKey: queryKeys.messaging.friends(),
    queryFn: fetchFriends,
    enabled: true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const friends = friendsQuery.data ?? [];
  const loading = friendsQuery.isPending;

  const prefetchThread = (friendId: string) => {
    void safePrefetchQuery(queryClient, {
      queryKey: queryKeys.messaging.thread(friendId),
      queryFn: () => fetchMessageThread(friendId),
    });
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading friends…</div>;
  if (friends.length === 0) return <div className="p-4 text-sm text-muted-foreground">No friends yet.</div>;

  return (
    <div className="space-y-3">
      {friends.map((friend) => (
        <div key={friend.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
          {friend.avatar ? <img src={friend.avatar} alt={friend.displayName} className="h-10 w-10 rounded-full" /> : <div className="h-10 w-10 rounded-full bg-muted" />}
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${friend.id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary transition-colors">
              {friend.displayName}
            </Link>
            <p className="text-xs text-muted-foreground">@{friend.username}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
              onMouseEnter={() => prefetchThread(friend.id)}
              onFocus={() => prefetchThread(friend.id)}
              onClick={() => {
                if (onMessage) {
                  onMessage(friend.id);
                  return;
                }

                router.push(`/notifications?user=${friend.id}`);
              }}
            >
              Message
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FriendsList;
