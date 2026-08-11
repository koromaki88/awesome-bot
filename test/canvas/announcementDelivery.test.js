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
    posted_at: '2026-08-11T12:00:00Z',
  });
  const embed = messages[0].embeds[0];

  assert.equal(embed.author.name, 'Announcement - Biology 101 (123)');
  assert.equal(embed.title, 'Lab update');
  assert.equal(embed.url, 'https://canvas.example.edu/courses/123/discussion_topics/456');
  assert.match(embed.description, /Bring goggles\./);
  assert.match(embed.description, /\[More info\]\(https:\/\/canvas\.example\.edu\/courses\/123\/pages\/info\)/);
  assert.match(embed.description, /\[Open in Canvas\]\(https:\/\/canvas\.example\.edu\/courses\/123\/discussion_topics\/456\)/);
  assert.equal(embed.image.url, 'https://canvas.example.edu/images/lab.png');
  assert.equal(embed.timestamp, '2026-08-11T12:00:00.000Z');
});

test('long announcement content is split across embeds', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Long update',
    message: `<p>${'Long content '.repeat(400)}</p>`,
  });

  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => message.embeds[0].description.length <= 3900));
  assert.equal(messages[0].embeds[0].author.name, 'Announcement - Biology 101 (123)');
  assert.match(messages[0].embeds[0].title, /Long update \(1\/\d+\)/);
});
