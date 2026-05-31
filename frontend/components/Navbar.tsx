"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Home, User, Bell, Sparkles, Users, BarChart3, ArrowLeftRight, FileText, SlidersHorizontal, Gift, ListPlus, LogOut } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SearchInput } from "./SearchInput";
import { useQueryClient } from "@tanstack/react-query";
import { scheduleDiscoverSeedsPrefetch, cancelScheduledPrefetch } from "@/lib/prefetchHelpers";
import { ThemeToggle } from "./ThemeToggle";
import { queryKeys } from "@/lib/queryKeys";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { appendNotificationToSnapshot, buildConversationSummaries, fetchMessagingSnapshot, getCurrentUserFromSnapshot, type MessagingSnapshot } from "@/lib/messaging";
import type { Message, NotificationItem, UserProfile } from "@/lib/types";
import logo from "@/assets/logo.svg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { label: "Discover", path: "/discover", icon: SlidersHorizontal },
  { label: "For You", path: "/recommendations", icon: Sparkles },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Shared Lists", path: "/shared-lists", icon: ListPlus },
  { label: "Stats", path: "/stats", icon: BarChart3 },
  { label: "Wrapped", path: "/wrapped", icon: Gift },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const sessionEmail = session?.user?.email ?? null;
  const notificationsKey = useMemo(() => queryKeys.notifications.all(sessionEmail), [sessionEmail]);
  const notificationsQuery = usePrefetchAwareQuery<MessagingSnapshot>({
    queryKey: notificationsKey,
    queryFn: fetchMessagingSnapshot,
    enabled: true,
  });

  useEffect(() => {
    const eventSource = new EventSource("/api/notifications/events");

    const handleNotificationCreated = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          recipientId?: string;
          notification?: NotificationItem;
        };

        const currentSnapshot = queryClient.getQueryData<MessagingSnapshot>(notificationsKey);
        const currentUser = currentSnapshot ? getCurrentUserFromSnapshot(currentSnapshot) : null;

        if (currentSnapshot && currentUser && payload.recipientId && payload.notification && payload.recipientId === currentUser.id) {
          queryClient.setQueryData<MessagingSnapshot>(notificationsKey, (current) => {
            if (!current) return current;
            return appendNotificationToSnapshot(current, payload.notification as NotificationItem);
          });
          return;
        }

        void notificationsQuery.refetch();
      } catch (error) {
        console.error("Navbar notification cache update failed:", error);
      }
    };

    eventSource.addEventListener("notification-created", handleNotificationCreated);
    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [notificationsKey, notificationsQuery.refetch, queryClient, session?.user?.email]);

  const snapshot = notificationsQuery.data;
  const currentUser = snapshot ? getCurrentUserFromSnapshot(snapshot) : null;
  const unreadNotificationCount = snapshot?.items.filter((notification) => !notification.read).length ?? 0;
  const unreadMessageCount = snapshot && currentUser ? buildConversationSummaries(snapshot, currentUser.id).reduce((total, conversation) => total + conversation.unreadCount, 0) : 0;
  const unreadCount = unreadNotificationCount + unreadMessageCount;

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-50 glass-surface border-b">
        <div className="container flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={logo.src} alt="Movirae" className="h-7" />
            <span className="font-display text-lg font-bold text-foreground">MOVIRAE</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ label, path, icon: Icon }) => {
              const token = `navbar:${path}`;
              const handleMouseEnter = () => {
                try {
                  if (path === "/discover") scheduleDiscoverSeedsPrefetch(queryClient, token, 150);
                } catch (err) {
                  console.debug("Navbar prefetch failed", err);
                }
              };

              const handleMouseLeave = () => {
                cancelScheduledPrefetch(token);
              };

              return (
                <Link
                  key={path}
                  href={path}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    pathname === path
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:block flex-1 max-w-md mx-4">
            <SearchInput />
          </div>

          <div className="flex items-center gap-2">
            {/* More menu for smaller screens */}
            <DropdownMenu>
              <DropdownMenuTrigger className="lg:hidden h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <SlidersHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navLinks.map(({ label, path, icon: Icon }) => (
                  <DropdownMenuItem key={path} asChild>
                    <Link href={path} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/compare" className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" /> Compare
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/import-export" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Import/Export
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/notifications"
              className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-primary px-0.5 text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <User className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-surface border-t">
        <div className="flex items-center justify-around h-14">
          {[
            { icon: Home, label: "Home", path: "/" },
            { icon: SlidersHorizontal, label: "Discover", path: "/discover" },
            { icon: Sparkles, label: "For You", path: "/recommendations" },
            { icon: Bell, label: "Alerts", path: "/notifications" },
            { icon: User, label: "Profile", path: "/profile" },
          ].map(({ icon: Icon, label, path }) => (
            <Link
              key={label}
              href={path}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 ${
                pathname === path ? "text-primary" : "text-muted-foreground"
              } transition-colors`}
            >
              <Icon className="h-5 w-5" />
              {label === "Alerts" && unreadCount > 0 && (
                <span className="absolute right-1 top-0 h-3.5 min-w-3.5 rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
