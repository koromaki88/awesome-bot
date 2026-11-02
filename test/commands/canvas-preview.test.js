import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-canvas-preview-')), 'bot.sqlite');

const { formatPreviewResult, parsePreviewPosition, parseTextPreviewArgs, previewCourseAnnouncement, toPreviewAnnouncement } = await import('../../src/commands/canvas/preview.js');
const { canvasCommand } = await import('../../src/commands/canvas/index.js');
const { initializeSchema } = await import('../../src/db/schema.js');
const { upsertCourseSubscription } = await import('../../src/db/subscriptions.js');
initializeSchema();

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

test('text preview arguments accept IDs, multi-word names, and optional positions', () => {
  assert.deepEqual(parseTextPreviewArgs([]), { courseInput: '', position: 1 });
  assert.deepEqual(parseTextPreviewArgs(['123']), { courseInput: '123', position: 1 });
  assert.deepEqual(parseTextPreviewArgs(['123', '2']), { courseInput: '123', position: 2 });
  assert.deepEqual(parseTextPreviewArgs(['operating', 'systems']), { courseInput: 'operating systems', position: 1 });
  assert.deepEqual(parseTextPreviewArgs(['operating', 'systems', '2']), { courseInput: 'operating systems', position: 2 });
  assert.deepEqual(parseTextPreviewArgs(['"Biology', '101"', '2']), { courseInput: 'Biology 101', position: 2 });
  assert.deepEqual(parseTextPreviewArgs(["'Biology", "101'"]), { courseInput: 'Biology 101', position: 1 });
});

test('text preview arguments reject invalid positions and broken quotes', () => {
  for (const args of [['123', '11'], ['operating', 'systems', '0'], ['123', 'oops'], ['"Biology', '101']]) {
    assert.equal(parseTextPreviewArgs(args), null);
  }
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

test('text and slash preview resolve a fuzzy course name and preserve announcement position', async (t) => {
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
  upsertCourseSubscription({
    guildId: 'guild-1', channelId: 'channel-1', canvasCourseId: '456', courseName: 'Operating Systems',
  });
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/courses/456') || url.includes('course_456&'));
    const data = url.endsWith('/courses/456')
      ? { id: 456, name: 'Operating Systems' }
      : [
        { title: 'Newest', message: '<p>Latest</p>', posted_at: '2030-01-02T12:00:00Z' },
        { title: 'Older', message: '<p>Second newest</p>', posted_at: '2030-01-01T12:00:00Z' },
      ];
    return { ok: true, headers: { get: () => null }, json: async () => data };
  });
  const sent = [];
  const confirmations = [];
  const channel = { id: 'channel-1', send: async (payload) => sent.push(payload) };
  await canvasCommand.text.execute({
    guildId: 'guild-1', channelId: 'channel-1', channel,
    reply: async () => ({ edit: async (content) => confirmations.push(content) }),
  }, ['preview', 'operatng', 'sytems', '2']);
  await canvasCommand.slash.execute({
    guildId: 'guild-1', channelId: 'channel-1', channel,
    options: {
      getSubcommand: () => 'preview',
      getString: () => 'operatng sytems',
      getInteger: () => 2,
    },
    deferReply: async () => {},
    editReply: async (content) => confirmations.push(content),
  });

  await canvasCommand.text.execute({
    guildId: 'guild-1', channelId: 'channel-1', channel,
    reply: async () => ({ edit: async (content) => confirmations.push(content) }),
  }, ['preview']);
  await canvasCommand.slash.execute({
    guildId: 'guild-1', channelId: 'channel-1', channel,
    options: {
      getSubcommand: () => 'preview',
      getString: (name, required) => {
        assert.notEqual(required, true);
        return null;
      },
      getInteger: () => 2,
    },
    deferReply: async () => {},
    editReply: async (content) => confirmations.push(content),
  });

  assert.deepEqual(confirmations, [
    'Previewed announcement 2.', 'Previewed announcement 2.',
    'Previewed announcement 1.', 'Previewed announcement 2.',
  ]);
  assert.equal(sent.length, 4);
  for (const payload of [sent[0], sent[1], sent[3]]) {
    const text = payload.components[0].components.map((component) => component.content ?? '').join('\n');
    assert.match(text, /## Older/);
    assert.match(text, /Second newest/);
  }
  assert.match(sent[2].components[0].components[0].content, /## Newest/);
});

test('unknown course names return a useful error without calling Canvas', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('No Canvas request expected'));
  const replies = [];
  const context = { guildId: 'guild-1', channelId: 'empty-channel', reply: async (payload) => replies.push(payload) };
  await canvasCommand.text.execute(context, ['preview', 'unknown', 'course']);
  await canvasCommand.slash.execute({
    ...context,
    options: { getSubcommand: () => 'preview', getString: () => 'unknown course' },
  });

  assert.equal(replies.length, 2);
  for (const payload of replies) assert.match(payload.content, /No matching Canvas course is watched in this channel/);
});

test('all default-course commands ask for clarification in empty or multi-course channels', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('No Canvas request expected'));
  for (const canvasCourseId of ['100', '200']) {
    upsertCourseSubscription({
      guildId: 'defaults-guild', channelId: 'multiple-courses', canvasCourseId,
      courseName: `Course ${canvasCourseId}`,
    });
  }
  for (const channelId of ['empty', 'multiple-courses']) {
    for (const subcommand of ['preview', 'assignments', 'asm']) {
      const replies = [];
      const context = {
        guildId: 'defaults-guild', channelId,
        reply: async (payload) => replies.push(payload),
      };
      await canvasCommand.text.execute(context, [subcommand]);
      await canvasCommand.slash.execute({
        ...context,
        options: { getSubcommand: () => subcommand, getString: () => null },
      });
      assert.equal(replies.length, 2);
      for (const payload of replies) {
        assert.match(payload.content, channelId === 'empty' ? /No Canvas courses/ : /Multiple Canvas courses/);
        assert.deepEqual(payload.allowedMentions, { parse: [] });
      }
    }
  }
});
