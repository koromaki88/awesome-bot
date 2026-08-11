import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-announcements-')), 'bot.sqlite');
process.env.CANVAS_BASE_URL = 'https://canvas.example.edu';

const { formatAnnouncementMessages } = await import('../../src/canvas/announcementDelivery.js');

test('announcement messages include title, text content, source link, and image urls', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Lab update',
    message: '<p>Bring goggles.<br><a href="/courses/123/pages/info">More info</a></p><img src="/images/lab.png">',
    html_url: 'https://canvas.example.edu/courses/123/discussion_topics/456',
  });

  assert.match(messages[0], /Canvas announcement for \*\*Biology 101\*\*/);
  assert.match(messages[0], /\*\*Lab update\*\*/);
  assert.match(messages[0], /Bring goggles\./);
  assert.match(messages[0], /More info \(https:\/\/canvas\.example\.edu\/courses\/123\/pages\/info\)/);
  assert.match(messages[0], /https:\/\/canvas\.example\.edu\/courses\/123\/discussion_topics\/456/);
  assert.equal(messages[1], 'https://canvas.example.edu/images/lab.png');
});

test('long announcement content is split across messages', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Long update',
    message: `<p>${'Long content '.repeat(250)}</p>`,
  });

  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => message.length <= 1900));
});
