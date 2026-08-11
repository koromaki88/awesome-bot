import { removeCourseSubscription } from '../../db/subscriptions.js';

export function unwatchCourse({ guildId, channelId, courseId }) {
  return removeCourseSubscription({
    guildId,
    channelId,
    canvasCourseId: String(courseId),
  });
}

export function formatNoSubscriptionMessage(courseId, channelId) {
  return `No reminder subscription found for Canvas course ${courseId} in <#${channelId}>.`;
}

export function formatUnwatchCourseResponse(removed, courseId, channelId) {
  return `Stopped reminders for **${removed.course_name ?? `Course ${courseId}`}** in <#${channelId}>.`;
}
