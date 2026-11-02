import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, InteractionContextType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

import { parsePurgeCount, purgeCommand } from '../../src/commands/purge.js';
import { enforceSlashPermission, enforceTextPermission, permissionLevels } from '../../src/permissions.js';

function fixture({ count = 5, oldIds = [], botPermissions } = {}) {
  const deletedIds = [];
  const fetches = [];
  const replies = [];
  const sends = [];
  const bulkCalls = [];
  const deletedReplies = [];
  const appPermissions = new PermissionsBitField(botPermissions ?? [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages,
  ]);
  const messages = Array.from({ length: count }, (_, index) => {
    const id = String(index + 1);
    return {
      id,
      createdTimestamp: Date.now() - (oldIds.includes(id) ? 15 : 1) * 24 * 60 * 60 * 1000,
      delete: async () => deletedIds.push(id),
    };
  });
  // Neither the invocation nor later arrivals should be selected for deletion.
  messages.push({ id: '200', createdTimestamp: Date.now() }, { id: '201', createdTimestamp: Date.now() });
  const channel = {
    permissionsFor: () => appPermissions,
    messages: {
      fetch: async (options) => {
        fetches.push(options);
        return new Collection(messages.filter((message) => BigInt(message.id) < BigInt(options.before))
          .sort((left, right) => Number(right.id) - Number(left.id))
          .slice(0, options.limit).map((message) => [message.id, message]));
      },
    },
    bulkDelete: async (selected, filterOld) => {
      bulkCalls.push({ selected, filterOld });
      deletedIds.push(...selected.keys());
      return selected;
    },
    send: async (content) => sends.push(content),
  };
  const message = {
    id: '200', guildId: 'guild-1', channel,
    client: { user: { id: 'bot' } },
    author: { id: 'admin' },
    member: { permissions: new PermissionsBitField(PermissionFlagsBits.Administrator) },
    reply: async (content) => replies.push(content),
    delete: async () => deletedIds.push('200'),
  };
  const interaction = {
    id: '200', guildId: 'guild-1', channel, appPermissions,
    user: { id: 'admin' }, memberPermissions: message.member.permissions,
    options: { getInteger: () => count },
    reply: async (payload) => replies.push(payload),
    deferReply: async (payload) => replies.push(payload),
    editReply: async (content) => sends.push(content),
    deleteReply: async () => deletedReplies.push(true),
  };
  return { message, interaction, channel, deletedIds, fetches, replies, sends, bulkCalls, deletedReplies };
}

test('purge exposes admin-only, guild-only slash and text metadata', () => {
  const data = purgeCommand.slash.data.toJSON();
  assert.equal(data.name, 'purge');
  assert.equal(purgeCommand.text.name, 'purge');
  assert.equal(purgeCommand.permissions.level, permissionLevels.serverAdmin);
  assert.equal(data.default_member_permissions, String(PermissionFlagsBits.Administrator));
  assert.deepEqual(data.contexts, [InteractionContextType.Guild]);
  assert.equal(data.options[0].name, 'count');
  assert.equal(data.options[0].min_value, 1);
  assert.equal(data.options[0].max_value, 100);
});

test('purge counts must be whole numbers from 1 to 100', () => {
  for (const input of ['1', '25', '100', 1, 100]) assert.equal(parsePurgeCount(input), Number(input));
  for (const input of [undefined, null, true, '', '0', '-1', '101', '1.5', '1e2', '10abc', 'Infinity']) {
    assert.equal(parsePurgeCount(input), null);
  }
});

test('text purge deletes X earlier messages plus the command, not later arrivals', async () => {
  const state = fixture();
  await purgeCommand.text.execute(state.message, ['3']);
  assert.deepEqual(state.fetches, [{ limit: 3, before: '200', cache: false }]);
  assert.deepEqual(state.deletedIds, ['5', '4', '3', '200']);
  assert.equal(state.bulkCalls.length, 1);
  assert.equal(state.bulkCalls[0].filterOld, true);
  assert.deepEqual(state.sends, []);
  assert.deepEqual(state.replies, []);
});

test('text purge supports 100 target messages without counting the command', async () => {
  const state = fixture({ count: 100 });
  await purgeCommand.text.execute(state.message, ['100']);
  assert.equal(state.deletedIds.length, 101);
  assert.equal(state.fetches[0].limit, 100);
  assert.equal(state.bulkCalls[0].selected.size, 100);
  assert.deepEqual(state.sends, []);
});

test('one-message purges delete the target individually', async () => {
  const state = fixture();
  await purgeCommand.text.execute(state.message, ['1']);
  assert.deepEqual(state.deletedIds, ['5', '200']);
  assert.equal(state.bulkCalls.length, 0);
  assert.deepEqual(state.sends, []);
});

test('old messages are skipped silently without backfilling', async () => {
  const state = fixture({ oldIds: ['4', '5'] });
  await purgeCommand.text.execute(state.message, ['3']);
  assert.deepEqual(state.deletedIds, ['3', '200']);
  assert.equal(state.fetches.length, 1);
  assert.deepEqual(state.sends, []);
  assert.deepEqual(state.replies, []);
});

test('empty history and entirely old selections do not call bulk deletion', async () => {
  for (const state of [fixture({ count: 0 }), fixture({ count: 2, oldIds: ['1', '2'] })]) {
    await purgeCommand.text.execute(state.message, ['5']);
    assert.deepEqual(state.deletedIds, ['200']);
    assert.equal(state.bulkCalls.length, 0);
    assert.deepEqual(state.sends, []);
  }
});

test('slash purge defers ephemerally and anchors deletion before the interaction', async () => {
  const state = fixture({ count: 3 });
  await purgeCommand.slash.execute(state.interaction);
  assert.deepEqual(state.replies, [{ ephemeral: true }]);
  assert.deepEqual(state.fetches, [{ limit: 3, before: '200', cache: false }]);
  assert.deepEqual(state.deletedIds, ['3', '2', '1']);
  assert.deepEqual(state.sends, []);
  assert.deepEqual(state.deletedReplies, [true]);
});

test('invalid counts, extra arguments, DMs, and missing bot permissions never delete messages', async () => {
  for (const args of [[], ['0'], ['101'], ['1.5'], ['2', 'extra']]) {
    const state = fixture();
    await purgeCommand.text.execute(state.message, args);
    assert.match(state.replies[0], /Usage:/);
    assert.equal(state.fetches.length, 0);
    assert.deepEqual(state.deletedIds, []);
  }
  const dm = fixture();
  await purgeCommand.text.execute({ ...dm.message, guildId: null }, ['3']);
  await purgeCommand.slash.execute({ ...dm.interaction, guildId: null });
  assert.match(dm.replies[0], /only be used in a server/);
  assert.match(dm.replies[1].content, /only be used in a server/);
  assert.deepEqual(dm.deletedIds, []);

  for (const permission of [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]) {
    const state = fixture({ botPermissions: [
      PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages,
    ].filter((flag) => flag !== permission) });
    await purgeCommand.text.execute(state.message, ['3']);
    await purgeCommand.slash.execute(state.interaction);
    assert.match(state.replies[0], /I need/);
    assert.match(state.replies[1].content, /I need/);
    assert.equal(state.fetches.length, 0);
    assert.deepEqual(state.deletedIds, []);
  }
});

test('only server administrators pass runtime permission checks', async () => {
  for (const admin of [true, false]) {
    const state = fixture();
    const permissions = new PermissionsBitField(admin ? PermissionFlagsBits.Administrator : PermissionFlagsBits.ManageMessages);
    state.message.member.permissions = permissions;
    state.interaction.memberPermissions = permissions;
    assert.equal(await enforceTextPermission(purgeCommand, state.message, ['3']), admin);
    assert.equal(await enforceSlashPermission(purgeCommand, state.interaction), admin);
    if (!admin) assert.match(state.replies[0], /do not have permission/);
    assert.deepEqual(state.deletedIds, []);
  }
});

test('deletion failure does not remove the command or claim a successful purge', async () => {
  const state = fixture();
  state.channel.bulkDelete = async () => { throw new Error('Discord unavailable'); };
  await assert.rejects(purgeCommand.text.execute(state.message, ['3']), /Discord unavailable/);
  assert.deepEqual(state.deletedIds, []);
  assert.deepEqual(state.sends, []);
});

test('an already removed command still finishes silently', async () => {
  const state = fixture();
  state.message.delete = async () => { throw Object.assign(new Error('Unknown Message'), { code: 10008 }); };
  await purgeCommand.text.execute(state.message, ['2']);
  assert.deepEqual(state.deletedIds, ['5', '4']);
  assert.deepEqual(state.sends, []);
  assert.deepEqual(state.replies, []);
});
