import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createNotification,
  listNotificationsForUser,
  countUnreadForUser,
  markRead,
  markAllRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification for a recipient", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "task_assigned",
        title: "New task",
        body: "You have been assigned a task",
      });

      expect(n).toBeDefined();
      expect(n.id).toBeDefined();
      expect(n.recipientUserId).toBe(base.user.id);
      expect(n.type).toBe("task_assigned");
      expect(n.title).toBe("New task");
      expect(n.body).toBe("You have been assigned a task");
      expect(n.status).toBe(schema.NotificationStatus.Unread);
      expect(n.createdAt).toBeDefined();
      expect(n.readAt).toBeNull();
    });

    it("creates notification with deepLink and metadata", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "file_processed",
        title: "File ready",
        body: "Your file has been processed",
        deepLink: "/files/123",
        metadata: { fileId: 123 },
      });

      expect(n.deepLink).toBe("/files/123");
      expect(n.metadata).toBe(JSON.stringify({ fileId: 123 }));
    });

    it("generates a unique UUID id for each notification", () => {
      const a = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Mention",
        body: "You were mentioned",
      });
      const b = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Mention",
        body: "You were mentioned again",
      });

      expect(a.id).not.toBe(b.id);
    });
  });

  describe("listNotificationsForUser", () => {
    it("returns only notifications for the specified user", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other User",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "For user",
        body: "Body",
      });
      createNotification({
        recipientUserId: otherUser.id,
        type: "mention",
        title: "For other",
        body: "Body",
      });

      const results = listNotificationsForUser({ userId: base.user.id });
      expect(results).toHaveLength(1);
      expect(results[0].recipientUserId).toBe(base.user.id);
    });

    it("returns notifications newest first", () => {
      testDb.insert(schema.notifications).values([
        {
          id: crypto.randomUUID(),
          recipientUserId: base.user.id,
          type: "mention",
          title: "Old",
          body: "Body",
          status: schema.NotificationStatus.Unread,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: crypto.randomUUID(),
          recipientUserId: base.user.id,
          type: "mention",
          title: "Newer",
          body: "Body",
          status: schema.NotificationStatus.Unread,
          createdAt: "2024-06-01T00:00:00.000Z",
        },
      ]).run();

      const results = listNotificationsForUser({ userId: base.user.id });
      expect(results[0].title).toBe("Newer");
      expect(results[1].title).toBe("Old");
    });

    it("returns empty array when user has no notifications", () => {
      const results = listNotificationsForUser({ userId: base.user.id });
      expect(results).toHaveLength(0);
    });

    it("filters by status=unread", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Unread",
        body: "Body",
      });
      markRead({ notificationId: n.id, userId: base.user.id });
      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Still unread",
        body: "Body",
      });

      const results = listNotificationsForUser({
        userId: base.user.id,
        status: "unread",
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Still unread");
    });

    it("filters by status=read", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Will be read",
        body: "Body",
      });
      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Stays unread",
        body: "Body",
      });
      markRead({ notificationId: n.id, userId: base.user.id });

      const results = listNotificationsForUser({
        userId: base.user.id,
        status: "read",
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Will be read");
    });

    it("respects the limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        createNotification({
          recipientUserId: base.user.id,
          type: "mention",
          title: `Notification ${i}`,
          body: "Body",
        });
      }

      const results = listNotificationsForUser({
        userId: base.user.id,
        limit: 3,
      });
      expect(results).toHaveLength(3);
    });

    it("applies cursor for pagination", () => {
      testDb.insert(schema.notifications).values([
        {
          id: crypto.randomUUID(),
          recipientUserId: base.user.id,
          type: "mention",
          title: "Old",
          body: "Body",
          status: schema.NotificationStatus.Unread,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: crypto.randomUUID(),
          recipientUserId: base.user.id,
          type: "mention",
          title: "Newer",
          body: "Body",
          status: schema.NotificationStatus.Unread,
          createdAt: "2024-06-01T00:00:00.000Z",
        },
      ]).run();

      const page1 = listNotificationsForUser({ userId: base.user.id, limit: 1 });
      expect(page1).toHaveLength(1);
      expect(page1[0].title).toBe("Newer");

      const page2 = listNotificationsForUser({
        userId: base.user.id,
        limit: 1,
        cursor: page1[0].createdAt,
      });
      expect(page2).toHaveLength(1);
      expect(page2[0].title).toBe("Old");
    });
  });

  describe("countUnreadForUser", () => {
    it("returns 0 when user has no notifications", () => {
      expect(countUnreadForUser(base.user.id)).toBe(0);
    });

    it("returns only unread count", () => {
      const n1 = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "One",
        body: "Body",
      });
      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Two",
        body: "Body",
      });
      markRead({ notificationId: n1.id, userId: base.user.id });

      expect(countUnreadForUser(base.user.id)).toBe(1);
    });

    it("does not count another user's notifications", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      createNotification({
        recipientUserId: otherUser.id,
        type: "mention",
        title: "For other",
        body: "Body",
      });

      expect(countUnreadForUser(base.user.id)).toBe(0);
    });
  });

  describe("markRead", () => {
    it("marks an unread notification as read", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Hello",
        body: "Body",
      });

      const updated = markRead({ notificationId: n.id, userId: base.user.id });
      expect(updated).toBeDefined();
      expect(updated!.status).toBe(schema.NotificationStatus.Read);
      expect(updated!.readAt).toBeDefined();
      expect(updated!.readAt).not.toBeNull();
    });

    it("is idempotent — marking already-read notification returns it unchanged", () => {
      const n = createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Hello",
        body: "Body",
      });
      markRead({ notificationId: n.id, userId: base.user.id });
      const second = markRead({ notificationId: n.id, userId: base.user.id });

      expect(second!.status).toBe(schema.NotificationStatus.Read);
    });

    it("returns null for a non-existent notification id", () => {
      const result = markRead({
        notificationId: "00000000-0000-0000-0000-000000000000",
        userId: base.user.id,
      });
      expect(result).toBeNull();
    });

    it("returns null when the notification belongs to another user", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const n = createNotification({
        recipientUserId: otherUser.id,
        type: "mention",
        title: "For other",
        body: "Body",
      });

      const result = markRead({ notificationId: n.id, userId: base.user.id });
      expect(result).toBeNull();
    });
  });

  describe("markAllRead", () => {
    it("marks all unread notifications as read for the user", () => {
      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "One",
        body: "Body",
      });
      createNotification({
        recipientUserId: base.user.id,
        type: "mention",
        title: "Two",
        body: "Body",
      });

      markAllRead(base.user.id);

      expect(countUnreadForUser(base.user.id)).toBe(0);
    });

    it("does not affect another user's notifications", () => {
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      createNotification({
        recipientUserId: otherUser.id,
        type: "mention",
        title: "For other",
        body: "Body",
      });

      markAllRead(base.user.id);

      expect(countUnreadForUser(otherUser.id)).toBe(1);
    });

    it("returns empty array when there are no unread notifications", () => {
      const result = markAllRead(base.user.id);
      expect(result).toHaveLength(0);
    });
  });
});
