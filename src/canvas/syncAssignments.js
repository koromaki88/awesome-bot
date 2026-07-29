import { upsertAssignment, createMissingRemindersForAssignment } from '../db/assignments.js';
import { getCourseSubscriptions, getCourseSubscriptionsByCourse } from '../db/subscriptions.js';
import { fetchCanvasAssignments } from './client.js';

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

export async function syncSubscribedCourses() {
  const subscriptions = getCourseSubscriptions();
  const courseIds = new Set();
  let syncedAssignments = 0;

  for (const subscription of subscriptions) {
    if (courseIds.has(subscription.canvas_course_id)) continue;

    courseIds.add(subscription.canvas_course_id);
    syncedAssignments += await syncCourseAssignments(subscription);
  }

  return { courses: courseIds.size, assignments: syncedAssignments };
}
