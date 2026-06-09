import { apiInternalError, apiNotFound, apiSuccess, apiUnauthorized, apiForbidden } from "@/app/notifications/lib/api-response";
import { requireAuth } from "@/app/notifications/lib/api-utils";
import { markNotificationRead } from "@/app/notifications/lib/notification-service";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth(_request);
    const { id } = await params;

    const result = await markNotificationRead(id, currentUser);
    if ("error" in result) {
      if (result.error === "not-found") return apiNotFound("Notification");
      if (result.error === "unauthorized") return apiForbidden();
      return apiInternalError("Failed to mark notification as read");
    }

    return apiSuccess(result.value);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiUnauthorized();
    }

    console.error("/api/notifications/[id]/read PATCH error:", error);
    return apiInternalError("Failed to mark notification as read");
  }
}
