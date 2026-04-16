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

import { getInstructorSummary, getRevenueTimeSeries, getCourseBreakdown } from "./analyticsService";

// Returns an ISO string for a date offset from now (negative = past)
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── getInstructorSummary ───

  describe("getInstructorSummary", () => {
    describe("correct aggregation per period", () => {
      it("sums revenue within the 7d period and excludes older purchases", () => {
        // Within window
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: daysAgo(3),
          })
          .run();

        // Outside window
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 5000,
            createdAt: daysAgo(8),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "7d",
        });

        expect(result.totalRevenue).toBe(2000);
      });

      it("sums revenue within the 30d period and excludes older purchases", () => {
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: daysAgo(3),
          })
          .run();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: daysAgo(20),
          })
          .run();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 9000,
            createdAt: daysAgo(45),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalRevenue).toBe(4000);
      });

      it("sums revenue within the 12m period and excludes older purchases", () => {
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: daysAgo(30),
          })
          .run();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: monthsAgo(11),
          })
          .run();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 9000,
            createdAt: monthsAgo(13),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "12m",
        });

        expect(result.totalRevenue).toBe(3000);
      });

      it("counts enrollments within the selected period", () => {
        testDb
          .insert(schema.enrollments)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: daysAgo(5),
          })
          .run();

        const otherUser = testDb
          .insert(schema.users)
          .values({
            name: "Other Student",
            email: "other@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.enrollments)
          .values({
            userId: otherUser.id,
            courseId: base.course.id,
            enrolledAt: daysAgo(40),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalEnrollments).toBe(1);
      });

      it("calculates average rating and count within the selected period", () => {
        const otherUser = testDb
          .insert(schema.users)
          .values({
            name: "Rater A",
            email: "rater-a@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        testDb
          .insert(schema.courseRatings)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            rating: 4,
            createdAt: daysAgo(5),
          })
          .run();

        testDb
          .insert(schema.courseRatings)
          .values({
            userId: otherUser.id,
            courseId: base.course.id,
            rating: 2,
            createdAt: daysAgo(5),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.avgRating).toBe(3);
        expect(result.ratingCount).toBe(2);
      });
    });

    describe("empty state", () => {
      it("returns all zeros when there are no purchases, enrollments, or ratings", () => {
        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalRevenue).toBe(0);
        expect(result.totalEnrollments).toBe(0);
        expect(result.avgRating).toBe(0);
        expect(result.ratingCount).toBe(0);
      });

      it("returns zero revenue when all purchases are outside the period", () => {
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 5000,
            createdAt: daysAgo(60),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalRevenue).toBe(0);
      });
    });

    describe("multi-instructor isolation", () => {
      it("only returns data for the specified instructor", () => {
        const otherInstructor = testDb
          .insert(schema.users)
          .values({
            name: "Other Instructor",
            email: "other-instructor@example.com",
            role: schema.UserRole.Instructor,
          })
          .returning()
          .get();

        const otherCourse = testDb
          .insert(schema.courses)
          .values({
            title: "Other Course",
            slug: "other-course",
            description: "Another instructor's course",
            instructorId: otherInstructor.id,
            categoryId: base.category.id,
            status: schema.CourseStatus.Published,
          })
          .returning()
          .get();

        // Purchase on base instructor's course
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: daysAgo(3),
          })
          .run();

        // Purchase on other instructor's course
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            createdAt: daysAgo(3),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalRevenue).toBe(3000);
      });

      it("returns zero for an instructor with no courses", () => {
        const emptyInstructor = testDb
          .insert(schema.users)
          .values({
            name: "Empty Instructor",
            email: "empty@example.com",
            role: schema.UserRole.Instructor,
          })
          .returning()
          .get();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 5000,
            createdAt: daysAgo(1),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: emptyInstructor.id,
          period: "30d",
        });

        expect(result.totalRevenue).toBe(0);
        expect(result.totalEnrollments).toBe(0);
      });
    });

    describe("boundary dates", () => {
      it("includes a purchase on the exact start of the 7d period", () => {
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1500,
            createdAt: daysAgo(6),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "7d",
        });

        expect(result.totalRevenue).toBe(1500);
      });

      it("excludes a purchase made 8 days ago from the 7d period", () => {
        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1500,
            createdAt: daysAgo(8),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "7d",
        });

        expect(result.totalRevenue).toBe(0);
      });

      it("includes an enrollment made 29 days ago in the 30d period", () => {
        testDb
          .insert(schema.enrollments)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: daysAgo(29),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalEnrollments).toBe(1);
      });

      it("excludes an enrollment made 31 days ago from the 30d period", () => {
        testDb
          .insert(schema.enrollments)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: daysAgo(31),
          })
          .run();

        const result = getInstructorSummary({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.totalEnrollments).toBe(0);
      });
    });
  });

  // ─── getRevenueTimeSeries ───

  describe("getRevenueTimeSeries", () => {
    describe("correct granularity", () => {
      it("returns 7 daily buckets for period 7d", () => {
        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "7d",
        });

        expect(result).toHaveLength(7);
        // Each date should be in YYYY-MM-DD format
        result.forEach((r) => expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
      });

      it("returns 30 daily buckets for period 30d", () => {
        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result).toHaveLength(30);
        result.forEach((r) => expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
      });

      it("returns 12 monthly buckets for period 12m", () => {
        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "12m",
        });

        expect(result).toHaveLength(12);
        // Each date should be in YYYY-MM format
        result.forEach((r) => expect(r.date).toMatch(/^\d{4}-\d{2}$/));
      });
    });

    describe("empty state", () => {
      it("returns zero revenue for all buckets when no purchases exist", () => {
        const result7d = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "7d",
        });

        expect(result7d).toHaveLength(7);
        result7d.forEach((r) => expect(r.revenue).toBe(0));
      });

      it("returns zero revenue for all monthly buckets when no purchases exist", () => {
        const result12m = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "12m",
        });

        expect(result12m).toHaveLength(12);
        result12m.forEach((r) => expect(r.revenue).toBe(0));
      });
    });

    describe("revenue summed correctly per bucket", () => {
      it("sums multiple purchases on the same day into one bucket", () => {
        const today = new Date().toISOString().slice(0, 10);

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: `${today}T10:00:00.000Z`,
          })
          .run();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: `${today}T14:00:00.000Z`,
          })
          .run();

        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "7d",
        });

        const todayBucket = result.find((r) => r.date === today);
        expect(todayBucket?.revenue).toBe(3000);
      });

      it("places purchase in correct daily bucket", () => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const bucketKey = threeDaysAgo.toISOString().slice(0, 10);

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4500,
            createdAt: daysAgo(3),
          })
          .run();

        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "7d",
        });

        const bucket = result.find((r) => r.date === bucketKey);
        expect(bucket?.revenue).toBe(4500);
      });

      it("excludes purchases from other instructors", () => {
        const otherInstructor = testDb
          .insert(schema.users)
          .values({
            name: "Other Instructor",
            email: "other-ts@example.com",
            role: schema.UserRole.Instructor,
          })
          .returning()
          .get();

        const otherCourse = testDb
          .insert(schema.courses)
          .values({
            title: "Other Course",
            slug: "other-ts-course",
            description: "Another course",
            instructorId: otherInstructor.id,
            categoryId: base.category.id,
            status: schema.CourseStatus.Published,
          })
          .returning()
          .get();

        testDb
          .insert(schema.purchases)
          .values({
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            createdAt: daysAgo(1),
          })
          .run();

        const result = getRevenueTimeSeries({
          instructorId: base.instructor.id,
          period: "7d",
        });

        const total = result.reduce((sum, r) => sum + r.revenue, 0);
        expect(total).toBe(0);
      });
    });
  });

  // ─── getCourseBreakdown ───

  describe("getCourseBreakdown", () => {
    describe("empty state", () => {
      it("returns empty array for instructor with no courses", () => {
        const emptyCourse = testDb
          .insert(schema.users)
          .values({
            name: "No Courses Instructor",
            email: "no-courses@example.com",
            role: schema.UserRole.Instructor,
          })
          .returning()
          .get();

        const result = getCourseBreakdown({
          instructorId: emptyCourse.id,
          period: "30d",
        });

        expect(result).toEqual([]);
      });

      it("returns zeros for course with no activity in the period", () => {
        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result).toHaveLength(1);
        expect(result[0].revenue).toBe(0);
        expect(result[0].enrollments).toBe(0);
        expect(result[0].avgRating).toBe(0);
        expect(result[0].ratingCount).toBe(0);
        expect(result[0].completionRate).toBe(0);
      });
    });

    describe("aggregation", () => {
      it("returns correct revenue, enrollments, ratings, and completion rate", () => {
        const studentB = testDb
          .insert(schema.users)
          .values({
            name: "Student B",
            email: "student-b@example.com",
            role: schema.UserRole.Student,
          })
          .returning()
          .get();

        // 2 purchases
        testDb
          .insert(schema.purchases)
          .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2000, createdAt: daysAgo(5) })
          .run();
        testDb
          .insert(schema.purchases)
          .values({ userId: studentB.id, courseId: base.course.id, pricePaid: 3000, createdAt: daysAgo(2) })
          .run();

        // 3 enrollments: 2 completed, 1 not
        testDb
          .insert(schema.enrollments)
          .values({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgo(5), completedAt: daysAgo(1) })
          .run();
        testDb
          .insert(schema.enrollments)
          .values({ userId: studentB.id, courseId: base.course.id, enrolledAt: daysAgo(4), completedAt: daysAgo(2) })
          .run();

        const studentC = testDb
          .insert(schema.users)
          .values({ name: "Student C", email: "student-c@example.com", role: schema.UserRole.Student })
          .returning()
          .get();
        testDb
          .insert(schema.enrollments)
          .values({ userId: studentC.id, courseId: base.course.id, enrolledAt: daysAgo(3) })
          .run();

        // 2 ratings: 4 and 2
        testDb
          .insert(schema.courseRatings)
          .values({ userId: base.user.id, courseId: base.course.id, rating: 4, createdAt: daysAgo(5) })
          .run();
        testDb
          .insert(schema.courseRatings)
          .values({ userId: studentB.id, courseId: base.course.id, rating: 2, createdAt: daysAgo(2) })
          .run();

        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result).toHaveLength(1);
        const row = result[0];
        expect(row.courseId).toBe(base.course.id);
        expect(row.title).toBe(base.course.title);
        expect(row.revenue).toBe(5000);
        expect(row.enrollments).toBe(3);
        expect(row.avgRating).toBe(3);
        expect(row.ratingCount).toBe(2);
        expect(row.completionRate).toBeCloseTo(2 / 3);
      });

      it("returns 0 completion rate when no enrollments", () => {
        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result[0].completionRate).toBe(0);
      });
    });

    describe("period scoping", () => {
      it("excludes purchases outside the period", () => {
        testDb
          .insert(schema.purchases)
          .values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, createdAt: daysAgo(45) })
          .run();

        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result[0].revenue).toBe(0);
      });

      it("excludes enrollments outside the period", () => {
        testDb
          .insert(schema.enrollments)
          .values({ userId: base.user.id, courseId: base.course.id, enrolledAt: daysAgo(45) })
          .run();

        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result[0].enrollments).toBe(0);
        expect(result[0].completionRate).toBe(0);
      });
    });

    describe("multi-instructor isolation", () => {
      it("does not include courses from other instructors", () => {
        const otherInstructor = testDb
          .insert(schema.users)
          .values({ name: "Other Inst", email: "other-cb@example.com", role: schema.UserRole.Instructor })
          .returning()
          .get();

        testDb
          .insert(schema.courses)
          .values({
            title: "Other Course",
            slug: "other-cb-course",
            description: "x",
            instructorId: otherInstructor.id,
            categoryId: base.category.id,
            status: schema.CourseStatus.Published,
          })
          .run();

        const result = getCourseBreakdown({
          instructorId: base.instructor.id,
          period: "30d",
        });

        expect(result.every((r) => r.courseId === base.course.id)).toBe(true);
      });
    });
  });
});
