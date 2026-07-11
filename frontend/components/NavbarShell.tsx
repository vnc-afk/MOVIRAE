"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, User, Bell, Sparkles, Users, BarChart3, ArrowLeftRight, FileText, SlidersHorizontal, Gift, ListPlus, LogOut } from "lucide-react";
import { useMemo } from "react";
import { ThemeToggle } from "./ThemeToggle";
import logo from "@/assets/logo.svg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useNavbarDataState } from "./NavbarContext";

const navLinks = [
  { label: "Discover", path: "/discover", icon: SlidersHorizontal },
  { label: "For You", path: "/recommendations", icon: Sparkles },
  { label: "Groups", path: "/groups", icon: Users },
  { label: "Shared Lists", path: "/shared-lists", icon: ListPlus },
  { label: "Stats", path: "/stats", icon: BarChart3 },
  { label: "Wrapped", path: "/wrapped", icon: Gift },
];

export function NavbarShell() {
  const pathname = usePathname();
  const { unreadCount } = useNavbarDataState();
  const notificationLabel = useMemo(() => (unreadCount > 9 ? "9+" : unreadCount), [unreadCount]);

  return (
    <>
      <nav className="sticky top-0 z-50 glass-surface border-b">
        <div className="container flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={logo.src} alt="Movirae" className="h-7" />
            <span className="font-display text-lg font-bold text-foreground">MOVIRAE</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  pathname === path
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
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
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-primary px-0.5 text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {notificationLabel}
                </span>
              ) : null}
            </Link>
            <ThemeToggle />
            <DropdownMenu modal={false}>
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
                <DropdownMenuItem
                  onClick={() => {
                    void signOut({ callbackUrl: "/login" });
                  }}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

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
              {label === "Alerts" && unreadCount > 0 ? (
                <span className="absolute right-1 top-0 h-3.5 min-w-3.5 rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                  {notificationLabel}
                </span>
              ) : null}
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
