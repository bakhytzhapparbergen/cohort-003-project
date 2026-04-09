import { eq, and, or, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function upsertCourseRating(userId: number, courseId: number, rating: number) {
  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { rating },
    })
    .returning()
    .get();
}

export function getCourseRatingStats(courseId: number): { average: number; count: number } {
  const result = db
    .select({
      average: sql<number>`CAST(AVG(${courseRatings.rating}) AS REAL)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return { average: result?.average ?? 0, count: result?.count ?? 0 };
}

export function getAverageRatingsForCourses(
  courseIds: number[]
): Map<number, { average: number; count: number }> {
  if (courseIds.length === 0) return new Map();

  const results = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`CAST(AVG(${courseRatings.rating}) AS REAL)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .where(or(...courseIds.map((id) => eq(courseRatings.courseId, id)))!)
    .groupBy(courseRatings.courseId)
    .all();

  const map = new Map<number, { average: number; count: number }>();
  for (const r of results) {
    map.set(r.courseId, { average: r.average, count: r.count });
  }
  return map;
}

export function getUserCourseRating(userId: number, courseId: number): number | null {
  const result = db
    .select({ rating: courseRatings.rating })
    .from(courseRatings)
    .where(and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)))
    .get();

  return result?.rating ?? null;
}
