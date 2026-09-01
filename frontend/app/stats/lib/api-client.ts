"use client";

import type { UserStats } from "@/lib/types";

/**
 * Fetch user stats from the stats API endpoint
 */
export async function fetchUserStats(): Promise<UserStats | null> {
  const response = await fetch("/api/stats", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    if (response.status === 401) return null;
    throw new Error(`Failed to fetch stats: ${response.status}`);
  }

  const data = await response.json();
  return data.value || null;
}
