import { apiInternalError, apiSuccess, apiUnauthorized } from "@/app/notifications/lib/api-response";
import { requireAuth, ApiError } from "@/app/notifications/lib/api-utils";
import { markAllNotificationsRead } from "@/services/notifications/notifications.server";

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
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return apiInternalError(error.message);
    }
    console.error("/api/notifications/read-all PATCH error:", error);
    return apiInternalError("Failed to mark notifications as read");
  }
}