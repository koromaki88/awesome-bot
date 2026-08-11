import { upsertAssignment, createMissingRemindersForAssignment } from '../db/assignments.js';
import { getCourseSubscriptions, getCourseSubscriptionsByCourse, getCourseSubscriptionsByGuild } from '../db/subscriptions.js';
import { fetchCanvasAssignments } from './client.js';
import { syncGuildSubscribedCourseAnnouncements, syncSubscribedCourseAnnouncements } from './syncAnnouncements.js';

export async function syncCourseAssignments(subscription) {
  const assignments = await fetchCanvasAssignments(subscription.canvas_course_id);
  const subscriptions = getCourseSubscriptionsByCourse(subscription.canvas_course_id);

  for (const canvasAssignment of assignments) {
    const assignment = upsertAssignment({
      canvasAssignmentId: String(canvasAssignment.id),
      canvasCourseId: String(subscription.canvas_course_id),
      courseName: subscription.course_name,
      name: canvasAssignment.name,
      htmlUrl: canvasAssignment.html_url,
      dueAt: canvasAssignment.due_at,
      workflowState: canvasAssignment.workflow_state,
      canvasUpdatedAt: canvasAssignment.updated_at,
    });

    for (const courseSubscription of subscriptions) {
      createMissingRemindersForAssignment(courseSubscription.id, assignment.id, assignment.due_at);
    }
  }

  return assignments.length;
}

async function syncSubscriptions(subscriptions) {
  const courseIds = new Set();
  let syncedAssignments = 0;

  for (const subscription of subscriptions) {
    if (courseIds.has(subscription.canvas_course_id)) continue;

    courseIds.add(subscription.canvas_course_id);
    syncedAssignments += await syncCourseAssignments(subscription);
  }

  return { courses: courseIds.size, assignments: syncedAssignments };
}

export async function syncSubscribedCourses() {
  const [assignmentsResult, announcementsResult] = await Promise.all([
    syncSubscriptions(getCourseSubscriptions()),
    syncSubscribedCourseAnnouncements(),
  ]);

  return {
    courses: assignmentsResult.courses,
    assignments: assignmentsResult.assignments,
    announcements: announcementsResult.announcements,
  };
}

export async function syncGuildSubscribedCourses(guildId) {
  const [assignmentsResult, announcementsResult] = await Promise.all([
    syncSubscriptions(getCourseSubscriptionsByGuild(guildId)),
    syncGuildSubscribedCourseAnnouncements(guildId),
  ]);

  return {
    courses: assignmentsResult.courses,
    assignments: assignmentsResult.assignments,
    announcements: announcementsResult.announcements,
  };
}
