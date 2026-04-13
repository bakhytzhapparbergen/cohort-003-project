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

// Import after mock so the module picks up our test db
import {
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function seedLesson(testDb: ReturnType<typeof createTestDb>, courseId: number) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module 1", position: 1 })
    .returning()
    .get();

  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();

  return { mod, lesson };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists and returns bookmarked: true", () => {
      const { lesson } = seedLesson(testDb, base.course.id);

      const result = toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(result.bookmarked).toBe(true);
    });

    it("removes the bookmark when one exists and returns bookmarked: false", () => {
      const { lesson } = seedLesson(testDb, base.course.id);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(result.bookmarked).toBe(false);
    });

    it("toggles back to true after two toggles", () => {
      const { lesson } = seedLesson(testDb, base.course.id);

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(result.bookmarked).toBe(true);
    });

    it("bookmarks for one user do not affect another user", () => {
      const { lesson } = seedLesson(testDb, base.course.id);
      const otherUser = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Student })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      const result = toggleBookmark({ userId: otherUser.id, lessonId: lesson.id });

      // Other user toggles independently — first toggle creates bookmark
      expect(result.bookmarked).toBe(true);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns true when lesson is bookmarked", () => {
      const { lesson } = seedLesson(testDb, base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })).toBe(true);
    });

    it("returns false when lesson is not bookmarked", () => {
      const { lesson } = seedLesson(testDb, base.course.id);

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })).toBe(false);
    });

    it("returns false after the bookmark is toggled off", () => {
      const { lesson } = seedLesson(testDb, base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      expect(isLessonBookmarked({ userId: base.user.id, lessonId: lesson.id })).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns lesson IDs bookmarked in the given course", () => {
      const { lesson } = seedLesson(testDb, base.course.id);
      toggleBookmark({ userId: base.user.id, lessonId: lesson.id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });

      expect(ids).toContain(lesson.id);
      expect(ids).toHaveLength(1);
    });

    it("returns an empty array when no bookmarks exist", () => {
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });

      expect(ids).toHaveLength(0);
    });

    it("does not return bookmarks from a different course", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2",
          slug: "course-2",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const { lesson: lesson2 } = seedLesson(testDb, course2.id);
      toggleBookmark({ userId: base.user.id, lessonId: lesson2.id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });

      expect(ids).toHaveLength(0);
    });

    it("returns multiple bookmarked lesson IDs", () => {
      const mod = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module", position: 1 })
        .returning()
        .get();
      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();
      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: "Lesson 2", position: 2 })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lesson1.id });
      toggleBookmark({ userId: base.user.id, lessonId: lesson2.id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });

      expect(ids).toHaveLength(2);
      expect(ids).toContain(lesson1.id);
      expect(ids).toContain(lesson2.id);
    });

    it("does not return bookmarks belonging to a different user", () => {
      const { lesson } = seedLesson(testDb, base.course.id);
      const otherUser = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      toggleBookmark({ userId: otherUser.id, lessonId: lesson.id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });

      expect(ids).toHaveLength(0);
    });
  });
});
