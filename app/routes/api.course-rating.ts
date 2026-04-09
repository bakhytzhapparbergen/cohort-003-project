import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.course-rating";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { upsertCourseRating } from "~/services/ratingService";

const courseRatingSchema = z.object({
  courseId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, courseRatingSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { courseId, rating } = parsed.data;

  const enrolled = isUserEnrolled(currentUserId, courseId);
  if (!enrolled) {
    throw data("You must be enrolled to rate this course", { status: 403 });
  }

  upsertCourseRating(currentUserId, courseId, rating);

  return { success: true };
}
