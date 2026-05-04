import { data } from "react-router";
import { getCurrentUserId } from "~/lib/session";
import { markAllRead } from "~/services/notificationService";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  markAllRead(currentUserId);

  return { success: true };
}
