import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-announcements-')), 'bot.sqlite');
process.env.CANVAS_BASE_URL = 'https://canvas.example.edu';

const { formatAnnouncementMessages } = await import('../../src/canvas/announcementDelivery.js');

function cardText(message) {
  return message.components[0].components
    .filter((component) => component.type === ComponentType.TextDisplay)
    .map((component) => component.content)
    .join('\n');
}

function galleryItems(message) {
  return message.components[0].components
    .filter((component) => component.type === ComponentType.MediaGallery)
    .flatMap((component) => component.items);
}

function assertValidCards(messages) {
  for (const message of messages) {
    assert.equal(message.flags, MessageFlags.IsComponentsV2);
    assert.deepEqual(message.allowedMentions, { parse: [] });
    assert.equal(message.embeds, undefined);
    assert.equal(message.content, undefined);
    assert.equal(message.components.length, 1);
    assert.equal(message.components[0].type, ComponentType.Container);
    assert.equal(message.components[0].accent_color, 0xe13f29);
    const children = message.components[0].components;
    const textLength = children.reduce((total, component) => total + (component.content?.length ?? 0), 0);
    assert.ok(textLength <= 4000);
    assert.ok(children.length + 1 <= 40);
    for (const child of children.filter((component) => component.type === ComponentType.MediaGallery)) {
      assert.ok(child.items.length >= 1 && child.items.length <= 10);
    }
  }
}

test('announcement card contains title, text, source link, timestamp, and images together', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Lab update',
    message: '<p>Bring goggles.<br><a href="/courses/123/pages/info">More info</a></p><img src="/images/lab.png">',
    html_url: 'https://canvas.example.edu/courses/123/discussion_topics/456',
    posted_at: '2026-08-11T12:00:00Z',
  });
  assertValidCards(messages);
  assert.equal(messages.length, 1);
  const text = cardText(messages[0]);
  assert.match(text, /Announcement - Biology 101 \(123\)/);
  assert.match(text, /## Lab update/);
  assert.match(text, /Bring goggles\./);
  assert.match(text, /\[More info\]\(https:\/\/canvas\.example\.edu\/courses\/123\/pages\/info\)/);
  assert.match(text, /\[Open in Canvas\]\(https:\/\/canvas\.example\.edu\/courses\/123\/discussion_topics\/456\)/);
  assert.match(text, new RegExp(`<t:${Date.parse('2026-08-11T12:00:00Z') / 1000}:f>`));
  assert.equal(galleryItems(messages[0])[0].media.url, 'https://canvas.example.edu/images/lab.png');
});

test('long announcement content is split across cards within the text budget', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Long update',
    message: `<p>${'Long content '.repeat(400)}</p>`,
  });

  assert.ok(messages.length > 1);
  assertValidCards(messages);
  assert.match(cardText(messages[0]), /Announcement - Biology 101 \(123\)/);
  assert.match(cardText(messages[0]), /Long update \(1\/\d+\)/);
  const bodies = messages.map((message) => message.components[0].components[1].content);
  assert.equal(bodies.join(' '), 'Long content '.repeat(400).trim());
});

test('long announcements keep narrow images in a gallery inside the final text card', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Biology 101',
    title: 'Long update with a narrow icon',
    message: `<p>${'Long announcement content '.repeat(400)}</p><img src="/images/tiny-icon.png">`,
  });
  assertValidCards(messages);
  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => cardText(message).includes('Long announcement content')));
  assert.equal(messages.flatMap(galleryItems).length, 1);
  assert.equal(galleryItems(messages.at(-1))[0].media.url, 'https://canvas.example.edu/images/tiny-icon.png');
});

test('image galleries overflow safely without losing or reordering images', () => {
  const images = Array.from({ length: 23 }, (_, index) => `/images/${index}.png`);
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    title: 'Many images',
    message: `<p>Photos from the lab</p>${images.map((url) => `<img src="${url}">`).join('')}`,
  });

  assertValidCards(messages);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages.map((message) => galleryItems(message).length), [10, 10, 3]);
  assert.deepEqual(messages.flatMap(galleryItems).map((item) => item.media.url),
    images.map((url) => `https://canvas.example.edu${url}`));
  assert.match(cardText(messages[0]), /Photos from the lab/);
});

test('missing content and invalid dates produce a valid text-only card', () => {
  const messages = formatAnnouncementMessages({ canvas_course_id: '123', posted_at: 'not-a-date' });

  assertValidCards(messages);
  assert.equal(messages.length, 1);
  assert.match(cardText(messages[0]), /Untitled announcement/);
  assert.match(cardText(messages[0]), /No announcement content\./);
  assert.doesNotMatch(cardText(messages[0]), /<t:/);
  assert.deepEqual(galleryItems(messages[0]), []);
});

test('large course names and titles are accounted for in the card text budget', () => {
  const messages = formatAnnouncementMessages({
    canvas_course_id: '123',
    course_name: 'Course '.repeat(100),
    title: 'Title '.repeat(100),
    message: `<p>${'Content '.repeat(1500)}</p>`,
    posted_at: '2026-08-11T12:00:00Z',
  });

  assertValidCards(messages);
});
