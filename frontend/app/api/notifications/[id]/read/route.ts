import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized, apiForbidden } from "@/app/notifications/lib/api-response";
import { requireAuth, ApiError } from "@/app/notifications/lib/api-utils";
import { markNotificationRead } from "@/services/notifications/notifications.server";

export const runtime = "nodejs";

/**
 * Marks a single notification as read for the authenticated user.
 *
 * The route validates ownership and returns standard API error responses
 * for missing or unauthorized access.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth(_request);
    const { id } = await params;

    const result = await markNotificationRead(id, currentUser);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "NOT_FOUND") return apiNotFound("Notification");
      if (error.code === "FORBIDDEN") return apiForbidden();
      if (error.code === "UNAUTHORIZED") return apiUnauthorized();
      return apiInternalError(error.message);
    }

    console.error("/api/notifications/[id]/read PATCH error:", error);
    return apiInternalError("Failed to mark notification as read");
  }
}
