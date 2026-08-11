import { createMissingRemindersForSubscription } from '../../db/assignments.js';
import { upsertCourseSubscription } from '../../db/subscriptions.js';
import { fetchCanvasCourse } from '../../canvas/client.js';
import { syncCourseAssignments } from '../../canvas/syncAssignments.js';
import { requireCanvasConfig } from './shared.js';

export async function subscribeToCourse({ guildId, channelId, courseId }) {
  requireCanvasConfig();

  const course = await fetchCanvasCourse(courseId);
  const subscription = upsertCourseSubscription({
    guildId,
    channelId,
    canvasCourseId: String(course.id),
    courseName: course.name ?? course.course_code ?? `Course ${course.id}`,
  });

  createMissingRemindersForSubscription(subscription);
  const assignmentCount = await syncCourseAssignments(subscription);

  return { subscription, assignmentCount };
}

export function formatWatchCourseResponse(subscription, assignmentCount) {
  return `Watching **${subscription.course_name}** in <#${subscription.channel_id}>. Synced ${assignmentCount} upcoming assignment(s).`;
}
