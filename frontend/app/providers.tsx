"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { OptimisticProvider } from "@/hooks/OptimisticProvider";
import { Navbar } from "@/components/Navbar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initializeGenreMap } from "@/lib/tmdb";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
            refetchOnMount: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  // subscribe to query cache to mark when a query becomes observed (possible navigation/view)
  useEffect(() => {
    try {
      // lazy require to avoid SSR issues
      const telemetry = require("@/lib/prefetchTelemetry").default;

      // start periodic flush of telemetry (client-only)
      try {
        telemetry.startAutoFlush?.();
      } catch {}

      return () => {
        try {
          telemetry.stopAutoFlush?.();
        } catch {}
      };
    } catch {
      // best-effort
    }
  }, [queryClient]);

  useEffect(() => {
    initializeGenreMap();
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <OptimisticProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthGuard>{children}</AuthGuard>
          </TooltipProvider>
        </OptimisticProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname?.startsWith("/login") ?? false;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!pathname) return;

    const currentSearch = window.location.search;
    const callbackUrl = pathname + currentSearch;

    if (isLoginRoute && status === "authenticated") {
      const loginSearchParams = new URLSearchParams(currentSearch);
      router.replace(loginSearchParams.get("callbackUrl") || "/");
      return;
    }

    if (isLoginRoute) return;

    if (status === "unauthenticated") {
      console.debug("AuthGuard redirecting unauthenticated ->", callbackUrl);
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [isLoginRoute, status, pathname, router]);

  if (isLoginRoute) {
    if (status === "authenticated") return null;
    return <>{children}</>;
  }

  // while session is loading or we're redirecting, don't render protected UI
  if (status === "loading" || status === "unauthenticated") return null;

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
