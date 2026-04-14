import { data } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/api.course-rating";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { isUserEnrolled } from "~/services/enrollmentService";
import { upsertCourseRating } from "~/services/ratingService";

const courseRatingSchema = v.object({
  courseId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  rating: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
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
