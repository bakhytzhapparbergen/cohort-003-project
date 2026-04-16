import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings, courses, enrollments, purchases } from "~/db/schema";

export type Period = "7d" | "30d" | "12m";

export function getStartDate(period: Period): string {
  const date = new Date();
  if (period === "7d") {
    date.setDate(date.getDate() - 7);
  } else if (period === "30d") {
    date.setDate(date.getDate() - 30);
  } else {
    date.setFullYear(date.getFullYear() - 1);
  }
  return date.toISOString();
}

export function getInstructorSummary(opts: {
  instructorId: number;
  period: Period;
}): {
  totalRevenue: number;
  totalEnrollments: number;
  avgRating: number;
  ratingCount: number;
} {
  const startDate = getStartDate(opts.period);

  const revenueResult = db
    .select({ total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(eq(courses.instructorId, opts.instructorId), gte(purchases.createdAt, startDate))
    )
    .get();

  const enrollmentsResult = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, opts.instructorId),
        gte(enrollments.enrolledAt, startDate)
      )
    )
    .get();

  const ratingResult = db
    .select({
      avg: sql<number>`CAST(AVG(${courseRatings.rating}) AS REAL)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, opts.instructorId),
        gte(courseRatings.createdAt, startDate)
      )
    )
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentsResult?.count ?? 0,
    avgRating: ratingResult?.avg ?? 0,
    ratingCount: ratingResult?.count ?? 0,
  };
}
