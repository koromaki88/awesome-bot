import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';

const { canvasCommand } = await import('../src/commands/canvas/index.js');
const { enforceSlashPermission, enforceTextPermission } = await import('../src/permissions.js');
const { initializeSchema } = await import('../src/db/schema.js');
initializeSchema();

test('unapproved members can view the Canvas watchlist through either interface', async (t) => {
  const previousIds = process.env.APPROVED_USER_IDS;
  process.env.APPROVED_USER_IDS = 'approved-user';
  t.after(() => {
    if (previousIds === undefined) delete process.env.APPROVED_USER_IDS;
    else process.env.APPROVED_USER_IDS = previousIds;
  });

  const textReplies = [];
  const message = {
    author: { id: 'ordinary-member' },
    guildId: 'test-guild',
    reply: async (payload) => textReplies.push(payload),
  };
  assert.equal(await enforceTextPermission(canvasCommand, message, ['WATCHLIST']), true);
  assert.equal(textReplies.length, 0);
  await canvasCommand.text.execute(message, ['WATCHLIST']);
  assert.equal(textReplies.length, 1);
  assert.doesNotMatch(textReplies[0], /permission/);

  const slashReplies = [];
  const interaction = {
    user: { id: 'ordinary-member' },
    guildId: 'test-guild',
    options: { getSubcommand: () => 'watchlist' },
    reply: async (payload) => slashReplies.push(payload),
  };
  assert.equal(await enforceSlashPermission(canvasCommand, interaction), true);
  assert.equal(slashReplies.length, 0);
  await canvasCommand.slash.execute(interaction);
  assert.equal(slashReplies.length, 1);
  assert.doesNotMatch(slashReplies[0].content, /permission/);
});

test('unapproved members can use Canvas preview and assignments through either interface', async (t) => {
  const previousIds = process.env.APPROVED_USER_IDS;
  process.env.APPROVED_USER_IDS = '';
  t.after(() => {
    if (previousIds === undefined) delete process.env.APPROVED_USER_IDS;
    else process.env.APPROVED_USER_IDS = previousIds;
  });

  const reply = async () => assert.fail('Public commands should not be denied');
  for (const subcommand of ['preview', 'assignments', 'asm']) {
    assert.equal(await enforceTextPermission(canvasCommand, {
      author: { id: 'ordinary-member' }, reply,
    }, [subcommand.toUpperCase(), '123']), true);
    assert.equal(await enforceSlashPermission(canvasCommand, {
      user: { id: 'ordinary-member' },
      options: { getSubcommand: () => subcommand },
      reply,
    }), true);
  }
});

test('other Canvas subcommands still require approved-user access', async (t) => {
  const previousIds = process.env.APPROVED_USER_IDS;
  process.env.APPROVED_USER_IDS = 'approved-user';
  t.after(() => {
    if (previousIds === undefined) delete process.env.APPROVED_USER_IDS;
    else process.env.APPROVED_USER_IDS = previousIds;
  });

  for (const subcommand of ['watch', 'unwatch', 'sync', 'help', 'unknown', undefined]) {
    const args = subcommand ? [subcommand] : [];
    for (const userId of ['ordinary-member', 'approved-user']) {
      const expected = userId === 'approved-user';
      const textReplies = [];
      const message = {
        author: { id: userId },
        reply: async (payload) => textReplies.push(payload),
      };
      assert.equal(await enforceTextPermission(canvasCommand, message, args), expected);
      assert.equal(textReplies.length, expected ? 0 : 1);

      const slashReplies = [];
      const interaction = {
        user: { id: userId },
        options: { getSubcommand: () => subcommand ?? null },
        reply: async (payload) => slashReplies.push(payload),
      };
      assert.equal(await enforceSlashPermission(canvasCommand, interaction), expected);
      assert.equal(slashReplies.length, expected ? 0 : 1);
      if (!expected) {
        assert.equal(textReplies[0], 'You do not have permission to use this command.');
        assert.deepEqual(slashReplies[0], {
          content: 'You do not have permission to use this command.',
          ephemeral: true,
        });
      }
    }
  }
});
