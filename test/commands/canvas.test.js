import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-canvas-')), 'bot.sqlite');

const { canvasCommand } = await import('../../src/commands/canvas.js');
const { permissionLevels } = await import('../../src/permissions.js');

test('canvas command exposes slash and text metadata', () => {
  const slash = canvasCommand.slash.data.toJSON();

  assert.equal(slash.name, 'canvas');
  assert.equal(typeof slash.description, 'string');
  assert.equal(canvasCommand.text.name, 'canvas');
  assert.deepEqual(canvasCommand.text.aliases, []);
  assert.equal(typeof canvasCommand.slash.execute, 'function');
  assert.equal(typeof canvasCommand.text.execute, 'function');
});

test('canvas command exposes the expected slash subcommands', () => {
  const slash = canvasCommand.slash.data.toJSON();
  const subcommandNames = slash.options.map((option) => option.name);

  assert.deepEqual(subcommandNames, ['watch', 'unwatch', 'watchlist', 'sync']);
});

test('canvas command is privileged', () => {
  assert.equal(canvasCommand.permissions.level, permissionLevels.privilegedUser);
});

test('canvas text command returns usage for unknown subcommands', async () => {
  let replyContent;
  const fakeMessage = {
    guildId: 'guild-1',
    async reply(content) {
      replyContent = content;
    },
  };

  await canvasCommand.text.execute(fakeMessage, ['unknown']);

  assert.equal(replyContent, 'Usage: `!canvas <watch|unwatch|watchlist|sync> [canvasCourseId] [#channel]`');
});

test('canvas text command returns usage for missing subcommands', async () => {
  let replyContent;
  const fakeMessage = {
    guildId: 'guild-1',
    async reply(content) {
      replyContent = content;
    },
  };

  await canvasCommand.text.execute(fakeMessage, []);

  assert.equal(replyContent, 'Usage: `!canvas <watch|unwatch|watchlist|sync> [canvasCourseId] [#channel]`');
});

test('canvas text command returns server-only message outside a guild', async () => {
  let replyContent;
  const fakeMessage = {
    guildId: null,
    async reply(content) {
      replyContent = content;
    },
  };

  await canvasCommand.text.execute(fakeMessage, ['watchlist']);

  assert.equal(replyContent, 'This command can only be used in a server.');
});

test('canvas slash command returns server-only message outside a guild', async () => {
  let replyPayload;
  const fakeInteraction = {
    guildId: null,
    async reply(payload) {
      replyPayload = payload;
    },
  };

  await canvasCommand.slash.execute(fakeInteraction);

  assert.deepEqual(replyPayload, {
    content: 'This command can only be used in a server.',
    ephemeral: true,
  });
});
