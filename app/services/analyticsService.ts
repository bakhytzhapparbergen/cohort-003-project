import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings, courses, enrollments, purchases } from "~/db/schema";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateDailyBuckets(days: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push(d.toISOString().slice(0, 10));
  }
  return buckets;
}

function generateMonthlyBuckets(months: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    buckets.push(d.toISOString().slice(0, 7));
  }
  return buckets;
}

export type Period = "7d" | "30d" | "12m" | "all";

export function getStartDate(period: Period): string | null {
  if (period === "all") return null;
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
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(purchases.createdAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .get();

  const enrollmentsResult = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(enrollments.enrolledAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
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
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(courseRatings.createdAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentsResult?.count ?? 0,
    avgRating: ratingResult?.avg ?? 0,
    ratingCount: ratingResult?.count ?? 0,
  };
}

export function getRevenueTimeSeries(opts: {
  instructorId: number;
  period: Period;
}): Array<{ date: string; revenue: number }> {
  const startDate = getStartDate(opts.period);
  const isMonthly = opts.period === "12m";

  const formatExpr = isMonthly
    ? sql<string>`strftime('%Y-%m', ${purchases.createdAt})`
    : sql<string>`strftime('%Y-%m-%d', ${purchases.createdAt})`;

  const rows = db
    .select({
      bucket: formatExpr,
      revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(purchases.createdAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .groupBy(formatExpr)
    .all();

  const dataMap = new Map(rows.map((r) => [r.bucket, r.revenue]));

  let buckets: string[];
  if (opts.period === "7d") {
    buckets = generateDailyBuckets(7);
  } else if (opts.period === "30d") {
    buckets = generateDailyBuckets(30);
  } else if (opts.period === "12m") {
    buckets = generateMonthlyBuckets(12);
  } else {
    // "all": return raw DB rows sorted by date
    return rows
      .map((r) => ({ date: r.bucket, revenue: r.revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return buckets.map((b) => ({ date: b, revenue: dataMap.get(b) ?? 0 }));
}

export function getCourseBreakdown(opts: {
  instructorId: number;
  period: Period;
}): Array<{
  courseId: number;
  title: string;
  revenue: number;
  enrollments: number;
  avgRating: number;
  ratingCount: number;
  completionRate: number;
}> {
  const startDate = getStartDate(opts.period);

  const instructorCourses = db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.instructorId, opts.instructorId))
    .all();

  if (instructorCourses.length === 0) return [];

  const revenueRows = db
    .select({
      courseId: purchases.courseId,
      revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(purchases.createdAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .groupBy(purchases.courseId)
    .all();

  const enrollmentRows = db
    .select({
      courseId: enrollments.courseId,
      count: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(${enrollments.completedAt})`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(enrollments.enrolledAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .groupBy(enrollments.courseId)
    .all();

  const ratingRows = db
    .select({
      courseId: courseRatings.courseId,
      avg: sql<number>`CAST(AVG(${courseRatings.rating}) AS REAL)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(
      startDate
        ? and(eq(courses.instructorId, opts.instructorId), gte(courseRatings.createdAt, startDate))
        : eq(courses.instructorId, opts.instructorId)
    )
    .groupBy(courseRatings.courseId)
    .all();

  const revenueMap = new Map(revenueRows.map((r) => [r.courseId, r.revenue]));
  const enrollmentMap = new Map(enrollmentRows.map((r) => [r.courseId, r]));
  const ratingMap = new Map(ratingRows.map((r) => [r.courseId, r]));

  return instructorCourses.map((course) => {
    const enr = enrollmentMap.get(course.id);
    const rat = ratingMap.get(course.id);
    const enrCount = enr?.count ?? 0;
    const completed = enr?.completed ?? 0;

    return {
      courseId: course.id,
      title: course.title,
      revenue: revenueMap.get(course.id) ?? 0,
      enrollments: enrCount,
      avgRating: rat?.avg ?? 0,
      ratingCount: rat?.count ?? 0,
      completionRate: enrCount > 0 ? completed / enrCount : 0,
    };
  });
}
