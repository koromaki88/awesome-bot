import { db } from './database.js';

const reminderDays = [14, 7, 3, 1];

export function upsertAssignment(assignment) {
  return db.prepare(`
    INSERT INTO assignments (
      canvas_assignment_id,
      canvas_course_id,
      course_name,
      name,
      html_url,
      due_at,
      workflow_state,
      canvas_updated_at
    )
    VALUES (
      @canvasAssignmentId,
      @canvasCourseId,
      @courseName,
      @name,
      @htmlUrl,
      @dueAt,
      @workflowState,
      @canvasUpdatedAt
    )
    ON CONFLICT(canvas_assignment_id, canvas_course_id) DO UPDATE SET
      course_name = excluded.course_name,
      name = excluded.name,
      html_url = excluded.html_url,
      due_at = excluded.due_at,
      workflow_state = excluded.workflow_state,
      canvas_updated_at = excluded.canvas_updated_at,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `).get(assignment);
}

export function createMissingRemindersForAssignment(subscriptionId, assignmentId, dueAt) {
  if (!dueAt) return;

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return;

  const insert = db.prepare(`
    INSERT INTO reminders (subscription_id, assignment_id, days_before, remind_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(subscription_id, assignment_id, days_before) DO UPDATE SET
      remind_at = excluded.remind_at
    WHERE reminders.sent_at IS NULL
  `);

  for (const daysBefore of reminderDays) {
    const remindAt = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
    if (remindAt < new Date()) continue;

    insert.run(subscriptionId, assignmentId, daysBefore, remindAt.toISOString());
  }
}

export function createMissingRemindersForSubscription(subscription) {
  const assignments = db.prepare(`
    SELECT id, due_at
    FROM assignments
    WHERE canvas_course_id = ?
      AND due_at IS NOT NULL
      AND COALESCE(workflow_state, '') != 'deleted'
  `).all(subscription.canvas_course_id);

  for (const assignment of assignments) {
    createMissingRemindersForAssignment(subscription.id, assignment.id, assignment.due_at);
  }
}

export function getDueReminders(now = new Date()) {
  return db.prepare(`
    SELECT
      reminders.id,
      reminders.days_before,
      reminders.remind_at,
      course_subscriptions.channel_id,
      course_subscriptions.canvas_course_id,
      assignments.name,
      assignments.course_name,
      assignments.html_url,
      assignments.due_at
    FROM reminders
    JOIN course_subscriptions ON course_subscriptions.id = reminders.subscription_id
    JOIN assignments ON assignments.id = reminders.assignment_id
    WHERE reminders.sent_at IS NULL
      AND reminders.remind_at <= ?
      AND assignments.due_at IS NOT NULL
      AND COALESCE(assignments.workflow_state, '') != 'deleted'
    ORDER BY reminders.remind_at ASC
  `).all(now.toISOString());
}

export function markReminderSent(reminderId) {
  db.prepare(`
    UPDATE reminders
    SET sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reminderId);
}
