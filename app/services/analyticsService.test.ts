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

import { getInstructorSummary } from "./analyticsService";

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
      it("includes a purchase made 6 days ago in the 7d period", () => {
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
});
