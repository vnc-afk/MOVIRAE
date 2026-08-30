"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<React.ComponentPropsWithoutRef<"a">, "href"> {
  href: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, href, ...props }, ref) => {
    const queryClient = useQueryClient();
    const tokenRef = useRef(`nav-link:${href}:${Math.random().toString(36).slice(2)}`);
    const pathname = usePathname();
    const isActive = pathname === href;
    const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      // preserve any provided onMouseEnter
      // @ts-ignore - props may include onMouseEnter
      props.onMouseEnter?.(e);

      try {
        if (typeof href === "string") {
          const m = href.match(/^\/movie\/([^/?#]+)/);
          const movieId = m?.[1];
          if (movieId) {
            void queryClient.prefetchQuery({
              queryKey: ["movie", "detail", movieId],
              queryFn: async () => {
                const response = await fetch(`/api/tmdb/movie/${movieId}`);
                if (!response.ok) return null;
                return response.json();
              },
            });
          }
        }
      } catch (err) {
        console.debug("NavLink prefetch failed", err);
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      // preserve any provided onMouseLeave
      // @ts-ignore
      props.onMouseLeave?.(e);
    };
    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
