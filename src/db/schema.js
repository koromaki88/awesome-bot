import { db } from './database.js';

export function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS course_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      canvas_course_id TEXT NOT NULL,
      course_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, channel_id, canvas_course_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canvas_assignment_id TEXT NOT NULL,
      canvas_course_id TEXT NOT NULL,
      course_name TEXT,
      name TEXT NOT NULL,
      html_url TEXT,
      due_at TEXT,
      workflow_state TEXT,
      canvas_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(canvas_assignment_id, canvas_course_id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      days_before INTEGER NOT NULL,
      remind_at TEXT NOT NULL,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES course_subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      UNIQUE(subscription_id, assignment_id, days_before)
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(canvas_course_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent_at, remind_at);
  `);
}
