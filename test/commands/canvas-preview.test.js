import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-canvas-preview-')), 'bot.sqlite');

const { formatPreviewResult, parsePreviewPosition, previewCourseAnnouncement, toPreviewAnnouncement } = await import('../../src/commands/canvas/preview.js');

test('preview position defaults to one', () => {
  assert.equal(parsePreviewPosition(undefined), 1);
});

test('preview position accepts integers from one to ten', () => {
  assert.equal(parsePreviewPosition('1'), 1);
  assert.equal(parsePreviewPosition('10'), 10);
});

test('preview position rejects invalid values', () => {
  assert.equal(parsePreviewPosition('0'), null);
  assert.equal(parsePreviewPosition('11'), null);
  assert.equal(parsePreviewPosition('1.5'), null);
  assert.equal(parsePreviewPosition('abc'), null);
});

test('preview result reports empty announcement previews', () => {
  assert.equal(formatPreviewResult(false, 3), 'No active Canvas announcement found at position 3 for that course.');
});

test('preview result reports sent announcements', () => {
  assert.equal(formatPreviewResult(true, 3), 'Previewed announcement 3.');
});

test('preview announcement uses fetched Canvas course name', () => {
  assert.deepEqual(
    toPreviewAnnouncement(
      {
        title: 'Announcement title',
        message: '<p>Body</p>',
        html_url: 'https://canvas.example.edu/announcement',
        posted_at: '2026-08-11T12:00:00Z',
      },
      {
        id: 171520,
        name: 'Operating Systems',
      },
    ),
    {
      canvas_course_id: '171520',
      course_name: 'Operating Systems',
      title: 'Announcement title',
      message: '<p>Body</p>',
      html_url: 'https://canvas.example.edu/announcement',
      posted_at: '2026-08-11T12:00:00Z',
    },
  );
});

test('preview sends text and images in the same Components V2 card', async (t) => {
  const previousBaseUrl = process.env.CANVAS_BASE_URL;
  const previousToken = process.env.CANVAS_ACCESS_TOKEN;
  process.env.CANVAS_BASE_URL = 'https://canvas.example.edu';
  process.env.CANVAS_ACCESS_TOKEN = 'test-token';
  t.after(() => {
    if (previousBaseUrl === undefined) delete process.env.CANVAS_BASE_URL;
    else process.env.CANVAS_BASE_URL = previousBaseUrl;
    if (previousToken === undefined) delete process.env.CANVAS_ACCESS_TOKEN;
    else process.env.CANVAS_ACCESS_TOKEN = previousToken;
  });
  t.mock.method(globalThis, 'fetch', async (url) => {
    const data = url.includes('/courses/123')
      ? { id: 123, name: 'Test Course' }
      : [{
        title: 'Preview announcement',
        message: '<p>Preview text</p><img src="/images/preview.png">',
        html_url: 'https://canvas.example.edu/announcement',
        posted_at: '2026-08-11T12:00:00Z',
      }];
    return { ok: true, headers: { get: () => null }, json: async () => data };
  });
  const sent = [];

  assert.equal(await previewCourseAnnouncement({
    courseId: '123',
    position: 1,
    channel: { send: async (message) => sent.push(message) },
  }), true);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].flags, MessageFlags.IsComponentsV2);
  assert.equal(sent[0].embeds, undefined);
  const container = sent[0].components[0];
  assert.equal(container.type, ComponentType.Container);
  assert.ok(container.components.some((component) => component.content?.includes('Preview text')));
  const gallery = container.components.find((component) => component.type === ComponentType.MediaGallery);
  assert.equal(gallery.items[0].media.url, 'https://canvas.example.edu/images/preview.png');
});
