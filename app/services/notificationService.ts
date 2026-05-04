import { eq, and, desc, lt, sql } from "drizzle-orm";
import { db } from "~/db";
import { notifications, NotificationStatus } from "~/db/schema";

export function createNotification(opts: {
  recipientUserId: number;
  type: string;
  title: string;
  body: string;
  deepLink?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  return db
    .insert(notifications)
    .values({
      id,
      recipientUserId: opts.recipientUserId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      status: NotificationStatus.Unread,
      deepLink: opts.deepLink ?? null,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    })
    .returning()
    .get();
}

export function listNotificationsForUser(opts: {
  userId: number;
  limit?: number;
  cursor?: string;
  status?: "unread" | "read" | "all";
}) {
  const limit = opts.limit ?? 20;
  const statusFilter = opts.status ?? "all";

  const conditions = [eq(notifications.recipientUserId, opts.userId)];

  if (statusFilter === "unread") {
    conditions.push(eq(notifications.status, NotificationStatus.Unread));
  } else if (statusFilter === "read") {
    conditions.push(eq(notifications.status, NotificationStatus.Read));
  }

  if (opts.cursor) {
    conditions.push(lt(notifications.createdAt, opts.cursor));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
}

export function countUnreadForUser(userId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.status, NotificationStatus.Unread)
      )
    )
    .get();

  return result?.count ?? 0;
}

export function markRead(opts: { notificationId: string; userId: number }) {
  const existing = db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, opts.notificationId),
        eq(notifications.recipientUserId, opts.userId)
      )
    )
    .get();

  if (!existing) {
    return null;
  }

  if (existing.status === NotificationStatus.Read) {
    return existing;
  }

  return db
    .update(notifications)
    .set({
      status: NotificationStatus.Read,
      readAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(notifications.id, opts.notificationId),
        eq(notifications.recipientUserId, opts.userId)
      )
    )
    .returning()
    .get();
}

export function markAllRead(userId: number) {
  return db
    .update(notifications)
    .set({
      status: NotificationStatus.Read,
      readAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.status, NotificationStatus.Unread)
      )
    )
    .returning()
    .all();
}
