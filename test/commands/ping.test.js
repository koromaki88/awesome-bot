import test from 'node:test';
import assert from 'node:assert/strict';

import { pingCommand } from '../../src/commands/ping.js';

/*
 * Verifies the ping command exposes both slash and text metadata.
 */
test('ping command exposes slash and text metadata', () => {
  assert.equal(pingCommand.slash.data.toJSON().name, 'ping');
  assert.equal(pingCommand.text.name, 'ping');
  assert.deepEqual(pingCommand.text.aliases, []);
  assert.equal(typeof pingCommand.slash.execute, 'function');
  assert.equal(typeof pingCommand.text.execute, 'function');
});

/*
 * Verifies the text ping command replies, calculates latency, and edits its reply.
 */
test('text ping replies and edits with latency', async () => {
  let editedContent;

  const fakeReply = {
    createdTimestamp: 150,
    async edit(content) {
      editedContent = content;
    },
  };
  const fakeMessage = {
    createdTimestamp: 100,
    client: { ws: { ping: 42 } },
    async reply(content) {
      assert.equal(content, 'Pinging...');
      return fakeReply;
    },
  };

  await pingCommand.text.execute(fakeMessage);

  assert.equal(editedContent, 'Pong! `50ms`, WebSocket: `42ms`.');
});

/*
 * Verifies the slash ping command replies, calculates latency, and edits its reply.
 */
test('slash ping replies and edits with latency', async (t) => {
  t.mock.method(Date, 'now', () => 100);

  let editedContent;
  const fakeInteraction = {
    client: { ws: { ping: 33 } },
    async reply(content) {
      assert.equal(content, 'Pinging...');
    },
    async editReply(content) {
      editedContent = content;
    },
  };

  await pingCommand.slash.execute(fakeInteraction);

  assert.equal(editedContent, 'Pong! `0ms`, WebSocket: `33ms`.');
});
