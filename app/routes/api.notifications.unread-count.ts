import { data } from "react-router";
import { getCurrentUserId } from "~/lib/session";
import { countUnreadForUser } from "~/services/notificationService";

export async function loader({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const count = countUnreadForUser(currentUserId);

  return { count };
}
