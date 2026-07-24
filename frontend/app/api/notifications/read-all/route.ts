import { apiInternalError, apiSuccess, apiUnauthorized } from "@/app/notifications/lib/api-response";
import { requireAuth } from "@/app/notifications/lib/api-utils";
import { markAllNotificationsRead } from "@/app/notifications/lib/notification-service";

export const runtime = "nodejs";

/**
 * Marks all unread notifications as read for the authenticated user.
 *
 * This endpoint enforces authentication and translates service errors into
 * standard API responses.
 */
export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAuth(request);
    const result = await markAllNotificationsRead(currentUser);

    if ("error" in result) {
      if (result.error === "unauthorized") return apiUnauthorized();
      return apiInternalError("Failed to mark notifications as read");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }
    console.error("/api/notifications/read-all PATCH error:", error);
    return apiInternalError("Failed to mark notifications as read");
  }
}