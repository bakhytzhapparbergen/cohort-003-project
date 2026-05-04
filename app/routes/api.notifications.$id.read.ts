import { data } from "react-router";
import { getCurrentUserId } from "~/lib/session";
import { markRead } from "~/services/notificationService";

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const { id } = params;

  const updated = markRead({ notificationId: id, userId: currentUserId });
  if (!updated) {
    throw data("Notification not found", { status: 404 });
  }

  return { success: true, notification: updated };
}
