"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Home, User, Bell, Calendar, Music, Sparkles, Users, BarChart3, ArrowLeftRight, FileText, Gift, ListPlus, LogOut, LayoutGrid, ChevronDown, Menu, Compass, Film, Search, Bot } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import logo from "@/assets/logo.svg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthModal } from "@/components/AuthModal";

const primaryNav = [
  { label: "Home", path: "/", icon: Home },
  { label: "Discover", path: "/discover", icon: Compass },
  { label: "Social", path: "/groups", icon: Users },
  { label: "Activity", path: "/notifications", icon: Bell },
];

const exploreGroups = [
  {
    label: "Discovery",
    items: [
      { label: "For You", path: "/recommendations", icon: Sparkles, desc: "Personalized picks" },
      { label: "Discover", path: "/discover", icon: Search, desc: "Find your next film" },
      { label: "Movie Assistant", path: "/ai-assistant", icon: Bot, desc: "Get a tailored recommendation" },
    ],
  },
  {
    label: "Collections",
    items: [
      { label: "Shared Lists", path: "/shared-lists", icon: ListPlus, desc: "Collaborate" },
      { label: "Calendar", path: "/calendar", icon: Calendar, desc: "Upcoming releases" },
      { label: "Soundtracks", path: "/soundtracks", icon: Music, desc: "Movie music" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Stats", path: "/stats", icon: BarChart3, desc: "Your analytics" },
      { label: "Wrapped", path: "/wrapped", icon: Gift, desc: "Year in review" },
    ],
  },
];

const utilityLinks = [
  { label: "Compare", path: "/compare", icon: ArrowLeftRight },
  { label: "Import/Export", path: "/import-export", icon: FileText },
];

export function NavbarShell() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { requireAuth } = useAuthModal();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <>
      <nav className="sticky top-0 z-50 glass-surface border-b">
        <div className="container flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Film className="h-5 w-5 text-primary sm:hidden" />
            <img src={logo.src} alt="Movirae" className="hidden h-7 sm:block" />
            <span className="font-display text-lg font-bold text-foreground">MOVIRAE</span>
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            {primaryNav.map(({ label, path, icon: Icon }) => <Link key={path} href={path} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</Link>)}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><LayoutGrid className="h-4 w-4" />Explore<ChevronDown className="h-3 w-3 opacity-50" /></DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-72 p-2">
                {exploreGroups.map((group, index) => <div key={group.label}>{index > 0 && <DropdownMenuSeparator />}<DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>{group.items.map(({ label, path, icon: Icon, desc }) => <DropdownMenuItem key={path} asChild><Link href={path} className={`flex items-center gap-3 rounded-md px-2 py-2 ${isActive(path) ? "bg-primary/10 text-primary" : ""}`}><Icon className="h-4 w-4 shrink-0" /><span className="flex flex-col"><span className="text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{desc}</span></span></Link></DropdownMenuItem>)}</div>)}
                <DropdownMenuSeparator />
                {utilityLinks.map(({ label, path, icon: Icon }) => <DropdownMenuItem key={path} asChild><Link href={path} className="flex items-center gap-3 px-2 py-1.5"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{label}</span></Link></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!session && (
              <button
                type="button"
                onClick={() => {
                  const callbackUrl = `${pathname}${window.location.search}`;
                  router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
                }}
                className="hidden rounded-full border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
              >
                Sign In
              </button>
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <User className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {session ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void signOut({ callbackUrl: "/" });
                      }}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => requireAuth()} className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 rotate-180" /> Sign In
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground md:hidden"><Menu className="h-4 w-4" /></SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="p-4 pb-2"><SheetTitle className="flex items-center gap-2 text-base"><Film className="h-4 w-4 text-primary" />MOVIRAE</SheetTitle></SheetHeader>
                <div className="overflow-y-auto px-2 pb-20">
                  <div className="py-2">{primaryNav.map(({ label, path, icon: Icon }) => <Link key={path} href={path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</Link>)}</div>
                  {exploreGroups.map((group) => <div key={group.label} className="border-t border-border py-2"><p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>{group.items.map(({ label, path, icon: Icon }) => <Link key={path} href={path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive(path) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</Link>)}</div>)}
                  <div className="border-t border-border py-2"><p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tools</p>{utilityLinks.map(({ label, path, icon: Icon }) => <Link key={path} href={path} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><Icon className="h-4 w-4" />{label}</Link>)}</div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-surface border-t">
        <div className="flex h-14 items-center justify-around">
          {[
            { icon: Home, label: "Home", path: "/" },
            { icon: Compass, label: "Discover", path: "/discover" },
            { icon: Sparkles, label: "For You", path: "/recommendations" },
            { icon: Users, label: "Social", path: "/groups" },
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
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
