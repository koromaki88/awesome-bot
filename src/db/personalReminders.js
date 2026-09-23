import { db } from './database.js';

export function createPersonalReminder({ userId, message, remindAt }) {
  return db.prepare(`
    INSERT INTO personal_reminders (user_id, message, remind_at)
    VALUES (@userId, @message, @remindAt)
    RETURNING *
  `).get({ userId, message, remindAt });
}

export function getDuePersonalReminders(now = new Date()) {
  return db.prepare(`
    SELECT *
    FROM personal_reminders
    WHERE sent_at IS NULL
      AND datetime(remind_at) <= datetime(?)
    ORDER BY remind_at ASC, id ASC
  `).all(now.toISOString());
}

export function markPersonalReminderSent(reminderId) {
  db.prepare(`
    UPDATE personal_reminders
    SET sent_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reminderId);
}
