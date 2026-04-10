import { and, eq, asc } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

export type CommentWithUser = {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
};

export function addComment(
  userId: number,
  lessonId: number,
  content: string
): void {
  db.insert(lessonComments).values({ userId, lessonId, content }).run();
}

export function getLessonComments(lessonId: number): CommentWithUser[] {
  return db
    .select({
      id: lessonComments.id,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(
      and(
        eq(lessonComments.lessonId, lessonId),
        eq(lessonComments.isDeleted, false)
      )
    )
    .orderBy(asc(lessonComments.createdAt))
    .all();
}

/**
 * Soft-deletes a comment if the actor is the comment author, the course
 * instructor, or an admin. Returns true if soft-deleted, false if not found
 * or not authorized.
 */
export function deleteComment(
  commentId: number,
  actorUserId: number,
  courseInstructorId: number,
  actorIsAdmin: boolean
): boolean {
  const comment = db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();

  if (!comment || comment.isDeleted) return false;

  const canDelete =
    comment.userId === actorUserId ||
    actorUserId === courseInstructorId ||
    actorIsAdmin;

  if (!canDelete) return false;

  db.update(lessonComments)
    .set({ isDeleted: true })
    .where(eq(lessonComments.id, commentId))
    .run();

  return true;
}
