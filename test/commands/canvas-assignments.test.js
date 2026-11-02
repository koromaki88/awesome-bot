import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbedBuilder } from 'discord.js';

process.env.DATABASE_PATH = ':memory:';

const { formatAssignmentMessages } = await import('../../src/commands/canvas/assignments.js');
const { canvasCommand } = await import('../../src/commands/canvas/index.js');
const { initializeSchema } = await import('../../src/db/schema.js');
const { upsertCourseSubscription } = await import('../../src/db/subscriptions.js');
initializeSchema();

function assignment(id, dueAt) {
  return { id, name: `Assignment ${id}`, due_at: dueAt, html_url: `https://canvas.example.edu/assignments/${id}` };
}

function configureCanvas(t) {
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
}

test('assignment lists sort due dates oldest first, including past assignments', () => {
  const assignments = [
    assignment(3, '2030-01-03T12:00:00Z'),
    assignment(1, '2020-01-01T12:00:00Z'),
    assignment(2, '2030-01-02T12:00:00Z'),
  ];
  const messages = formatAssignmentMessages({ id: 123, name: 'Operating Systems' }, assignments);
  const embed = messages[0].embeds[0];
  assert.equal(messages.length, 1);
  assert.equal(embed.title, 'Assignments — Operating Systems');
  assert.ok(embed.description.indexOf('Assignment 1') < embed.description.indexOf('Assignment 2'));
  assert.ok(embed.description.indexOf('Assignment 2') < embed.description.indexOf('Assignment 3'));
  assert.match(embed.description, /\[Assignment 1\]\(https:\/\/canvas\.example\.edu\/assignments\/1\)/);
  for (const item of assignments) {
    const seconds = Date.parse(item.due_at) / 1000;
    assert.ok(embed.description.includes(`<t:${seconds}:f> (<t:${seconds}:R>)`));
  }
  assert.deepEqual(assignments.map((item) => item.id), [3, 1, 2]);
});

test('undated and invalid dates appear last; deleted assignments are omitted', () => {
  const messages = formatAssignmentMessages({ id: 123 }, [
    assignment(3, null), assignment(2, 'invalid'), assignment(1, '2030-01-01T12:00:00Z'),
    { ...assignment(4, '2020-01-01T12:00:00Z'), workflow_state: 'deleted' },
  ]);
  const text = messages[0].embeds[0].description;
  assert.ok(text.indexOf('Assignment 1') < text.indexOf('Assignment 2'));
  assert.ok(text.indexOf('Assignment 1') < text.indexOf('Assignment 3'));
  assert.equal((text.match(/No due date/g) ?? []).length, 2);
  assert.doesNotMatch(text, /Assignment 4/);
});

test('long assignment lists paginate without dropping assignments or exceeding embed limits', () => {
  const assignments = Array.from({ length: 150 }, (_, index) => assignment(index + 1, '2030-01-01T12:00:00Z'));
  const messages = formatAssignmentMessages({ id: 123, name: 'Course' }, assignments);
  assert.ok(messages.length > 1);
  for (const message of messages) {
    assert.ok(message.embeds[0].description.length <= 3800);
    assert.doesNotThrow(() => new EmbedBuilder(message.embeds[0]).toJSON());
  }
  const text = messages.map((message) => message.embeds[0].description).join('\n');
  assert.equal((text.match(/\[Assignment \d+\]/g) ?? []).length, 150);
});

test('empty courses and assignments without links are handled', () => {
  assert.match(formatAssignmentMessages({ id: 123 }, [])[0].embeds[0].description, /No assignments found/);
  const text = formatAssignmentMessages({ id: 123 }, [{ name: '**Homework**', due_at: null }])[0].embeds[0].description;
  assert.ok(text.includes('\\*\\*Homework\\*\\*'));
  assert.match(text, /No due date/);
});

test('text and slash assignments fetch every Canvas page and accept course names', async (t) => {
  configureCanvas(t);
  upsertCourseSubscription({ guildId: 'guild-1', channelId: 'channel-1', canvasCourseId: '123', courseName: 'Biology 101' });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    assert.ok(!url.includes('bucket='), 'Assignment list must include past assignments');
    const courseRequest = url.endsWith('/courses/123');
    const secondPage = url.includes('page=2');
    const data = courseRequest ? { id: 123, name: 'Biology 101' }
      : secondPage ? [assignment(1, '2020-01-01T12:00:00Z')] : [assignment(2, '2030-01-01T12:00:00Z')];
    return {
      ok: true,
      json: async () => data,
      headers: { get: () => !courseRequest && !secondPage
        ? '<https://canvas.example.edu/api/v1/courses/123/assignments?page=2>; rel="next"' : null },
    };
  });
  const sent = [];
  await canvasCommand.text.execute({
    guildId: 'guild-1', channelId: 'channel-1',
    reply: async () => ({ edit: async (payload) => sent.push(payload) }),
  }, ['assignments', 'Biology', '101']);
  await canvasCommand.slash.execute({
    guildId: 'guild-1', channelId: 'channel-1',
    options: { getSubcommand: () => 'assignments', getString: () => '123' },
    deferReply: async () => {}, editReply: async (payload) => sent.push(payload),
  });
  assert.equal(requests.length, 6);
  assert.equal(sent.length, 2);
  for (const message of sent) {
    const text = message.embeds[0].description;
    assert.ok(text.indexOf('Assignment 1') < text.indexOf('Assignment 2'));
  }
});

test('asm aliases send all continuation messages for text and slash commands', async (t) => {
  configureCanvas(t);
  const assignments = Array.from({ length: 100 }, (_, index) => assignment(index + 1, '2030-01-01T12:00:00Z'));
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true, headers: { get: () => null },
    json: async () => url.endsWith('/courses/123') ? { id: 123, name: 'Biology 101' } : assignments,
  }));
  const textMessages = [];
  const slashMessages = [];
  await canvasCommand.text.execute({
    guildId: 'guild-1', channelId: 'channel-1',
    reply: async () => ({ edit: async (payload) => textMessages.push(payload) }),
    channel: { send: async (payload) => textMessages.push(payload) },
  }, ['ASM', '123']);
  await canvasCommand.slash.execute({
    guildId: 'guild-1', channelId: 'channel-1',
    options: { getSubcommand: () => 'asm', getString: () => '123' },
    deferReply: async () => {},
    editReply: async (payload) => slashMessages.push(payload),
    followUp: async (payload) => {
      assert.equal(payload.ephemeral, true);
      slashMessages.push(payload);
    },
  });
  assert.equal(textMessages[0].content, null, 'Loading text should be cleared');
  for (const messages of [textMessages, slashMessages]) {
    assert.ok(messages.length > 1);
    const text = messages.map((message) => message.embeds[0].description).join('\n');
    assert.equal((text.match(/\[Assignment \d+\]/g) ?? []).length, assignments.length);
  }
});

test('missing or unmatched courses produce an error without Canvas requests', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('No Canvas request expected'));
  const replies = [];
  const context = { guildId: 'guild-1', channelId: 'empty', reply: async (payload) => replies.push(payload) };
  await canvasCommand.text.execute(context, ['assignments']);
  await canvasCommand.text.execute(context, ['assignments', 'unknown', 'course']);
  await canvasCommand.slash.execute({ ...context, options: { getSubcommand: () => 'assignments', getString: () => 'unknown course' } });
  assert.match(replies[0], /Usage:/);
  for (const reply of replies.slice(1)) assert.match(reply.content, /No matching Canvas course/);
});
