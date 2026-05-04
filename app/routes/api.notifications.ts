import { data } from "react-router";
import * as v from "valibot";
import { getCurrentUserId } from "~/lib/session";
import { listNotificationsForUser } from "~/services/notificationService";

const querySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(100)
    )
  ),
  cursor: v.optional(v.string()),
  status: v.optional(
    v.picklist(["unread", "read", "all"] as const)
  ),
});

export async function loader({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const raw = {
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };

  const result = v.safeParse(querySchema, raw);
  if (!result.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { limit, cursor, status } = result.output;

  const items = listNotificationsForUser({
    userId: currentUserId,
    limit,
    cursor,
    status,
  });

  const nextCursor =
    items.length === (limit ?? 20) ? items[items.length - 1].createdAt : null;

  return { items, nextCursor };
}
