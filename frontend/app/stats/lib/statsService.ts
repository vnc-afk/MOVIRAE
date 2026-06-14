import type { UserStats } from "@/lib/types";
import { STATS_CONFIG } from "./constants";

export async function fetchUserStats(): Promise<UserStats | null> {
  const response = await fetch(STATS_CONFIG.API_PATH, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load stats: ${response.status}`);
  }

  const data = await response.json();
  return data?.data ?? null;
}
