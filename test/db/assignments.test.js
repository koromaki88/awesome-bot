import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-assignments-')), 'bot.sqlite');

const { db } = await import('../../src/db/database.js');
const { initializeSchema } = await import('../../src/db/schema.js');
const { getDueReminders, upsertAssignment } = await import('../../src/db/assignments.js');
const { upsertCourseSubscription } = await import('../../src/db/subscriptions.js');

initializeSchema();

function addReminder({ assignmentId, subscriptionId, remindAt }) {
  db.prepare(`
    INSERT INTO reminders (subscription_id, assignment_id, days_before, remind_at)
    VALUES (?, ?, 1, ?)
  `).run(subscriptionId, assignmentId, remindAt);
}

function addAssignment({ id, dueAt }) {
  return upsertAssignment({
    canvasAssignmentId: id,
    canvasCourseId: 'course-1',
    courseName: 'Test Course',
    name: `Assignment ${id}`,
    htmlUrl: null,
    dueAt,
    workflowState: 'published',
    canvasUpdatedAt: null,
  });
}

test('due reminders exclude assignments whose deadlines have passed', () => {
  const now = new Date('2030-01-10T12:00:00.000Z');
  const subscription = upsertCourseSubscription({
    guildId: 'guild-1',
    channelId: 'channel-1',
    canvasCourseId: 'course-1',
    courseName: 'Test Course',
  });
  const overdueAssignment = addAssignment({ id: 'overdue', dueAt: '2030-01-09T12:00:00.000Z' });
  const upcomingAssignment = addAssignment({ id: 'upcoming', dueAt: '2030-01-11T12:00:00.000Z' });

  addReminder({
    assignmentId: overdueAssignment.id,
    subscriptionId: subscription.id,
    remindAt: '2030-01-08T12:00:00.000Z',
  });
  addReminder({
    assignmentId: upcomingAssignment.id,
    subscriptionId: subscription.id,
    remindAt: '2030-01-10T11:00:00.000Z',
  });

  const reminders = getDueReminders(now);

  assert.deepEqual(reminders.map((reminder) => reminder.name), ['Assignment upcoming']);
});
