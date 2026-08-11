import { getDueReminders, markReminderSent } from '../db/assignments.js';
import { sendPendingAnnouncements } from '../canvas/announcementDelivery.js';
import { syncSubscribedCourses } from '../canvas/syncAssignments.js';

const reminderCheckMs = 10 * 60 * 1000;
const canvasSyncMs = 6 * 60 * 60 * 1000;

function hasCanvasConfig() {
  return Boolean(process.env.CANVAS_BASE_URL && process.env.CANVAS_ACCESS_TOKEN);
}

function formatDueDate(dueAt) {
  const timestamp = Math.floor(new Date(dueAt).getTime() / 1000);
  if (Number.isNaN(timestamp)) return 'unknown';

  return `<t:${timestamp}:f>`;
}

async function sendDueReminders(client) {
  const reminders = getDueReminders();

  for (const reminder of reminders) {
    const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
    if (!channel?.isTextBased()) continue;

    const courseName = reminder.course_name ?? `Course ${reminder.canvas_course_id}`;
    const link = reminder.html_url ? `\n${reminder.html_url}` : '';

    await channel.send(
      `Reminder: **${reminder.name}** for **${courseName}** is due in ${reminder.days_before} day(s).\nDue: ${formatDueDate(reminder.due_at)}${link}`,
    );

    markReminderSent(reminder.id);
  }
}

async function runCanvasSync(client) {
  if (!hasCanvasConfig()) {
    console.warn('Canvas sync skipped: missing CANVAS_BASE_URL or CANVAS_ACCESS_TOKEN.');
    return;
  }

  const result = await syncSubscribedCourses();
  console.log(`Canvas sync complete: ${result.courses} course(s), ${result.assignments} assignment(s), ${result.announcements} announcement(s).`);

  if (client) {
    await sendPendingAnnouncements(client);
  }
}

export function startReminderScheduler(client) {
  runCanvasSync(client).catch((error) => console.error('Canvas sync failed:', error));
  sendDueReminders(client).catch((error) => console.error('Reminder check failed:', error));

  setInterval(() => {
    runCanvasSync(client).catch((error) => console.error('Canvas sync failed:', error));
  }, canvasSyncMs);

  setInterval(() => {
    sendDueReminders(client).catch((error) => console.error('Reminder check failed:', error));
  }, reminderCheckMs);
}
