import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-remindme-')), 'bot.sqlite');

const { db } = await import('../../src/db/database.js');
const { initializeSchema } = await import('../../src/db/schema.js');
const { parseReminderDuration, remindmeCommand } = await import('../../src/commands/remindme.js');
const { formatPersonalReminder, sendDuePersonalReminders } = await import('../../src/reminders/scheduler.js');

initializeSchema();

test('remindme command exposes slash and text metadata', () => {
  const slash = remindmeCommand.slash.data.toJSON();

  assert.equal(slash.name, 'remindme');
  assert.deepEqual(slash.options.map((option) => option.name), ['duration', 'message']);
  assert.equal(remindmeCommand.text.name, 'remindme');
  assert.deepEqual(remindmeCommand.text.aliases, ['remind']);
});

test('reminder durations combine days, hours, and minutes', () => {
  assert.equal(parseReminderDuration('3d2h5m'), ((3 * 24 + 2) * 60 + 5) * 60 * 1000);
  assert.equal(parseReminderDuration('15m'), 15 * 60 * 1000);
  assert.equal(parseReminderDuration('2H30M'), 150 * 60 * 1000);
});

test('invalid or empty reminder durations are rejected', () => {
  assert.equal(parseReminderDuration(), null);
  assert.equal(parseReminderDuration('later'), null);
  assert.equal(parseReminderDuration('1h30'), null);
  assert.equal(parseReminderDuration('0m'), null);
});

test('text remindme stores a persistent reminder', async (t) => {
  t.mock.method(Date, 'now', () => Date.parse('2030-01-01T12:00:00.000Z'));
  let replyContent;
  const fakeMessage = {
    author: { id: 'user-1' },
    async reply(content) {
      replyContent = content;
    },
  };

  await remindmeCommand.text.execute(fakeMessage, ['3d2h5m', 'I', 'want', 'to', 'do', 'something']);

  const reminder = db.prepare('SELECT * FROM personal_reminders WHERE user_id = ?').get('user-1');
  assert.equal(reminder.message, 'I want to do something');
  assert.equal(reminder.remind_at, '2030-01-04T14:05:00.000Z');
  assert.match(replyContent, /I'll DM you a reminder/);
});

test('due personal reminders are sent by DM and marked sent', async () => {
  db.prepare('DELETE FROM personal_reminders').run();
  const reminder = db.prepare(`
    INSERT INTO personal_reminders (user_id, message, remind_at)
    VALUES ('user-2', 'I want to do something', '2020-01-01T00:00:00.000Z')
    RETURNING *
  `).get();
  let sentContent;
  const fakeClient = {
    users: {
      async fetch(userId) {
        assert.equal(userId, 'user-2');
        return {
          async send(content) {
            sentContent = content;
          },
        };
      },
    },
  };

  await sendDuePersonalReminders(fakeClient);

  assert.equal(sentContent, '**Reminder**: I want to do something');
  assert.equal(formatPersonalReminder('Check the oven'), '**Reminder**: Check the oven');
  assert.ok(db.prepare('SELECT sent_at FROM personal_reminders WHERE id = ?').get(reminder.id).sent_at);
});
