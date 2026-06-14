import { getUserStatsSnapshot } from "@/lib/aggregations";
import type { CurrentUser } from "./api-utils";

export async function getUserStats(currentUser: CurrentUser) {
  return await getUserStatsSnapshot(currentUser.id);
}
