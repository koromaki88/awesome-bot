import test from 'node:test';
import assert from 'node:assert/strict';

import { commitCommand } from '../../src/commands/commit.js';

test('commit command exposes slash and text metadata', () => {
  const slash = commitCommand.slash.data.toJSON();

  assert.equal(slash.name, 'commit');
  assert.equal(typeof slash.description, 'string');
  assert.equal(commitCommand.text.name, 'commit');
  assert.deepEqual(commitCommand.text.aliases, ['version', 'sha']);
  assert.equal(typeof commitCommand.slash.execute, 'function');
  assert.equal(typeof commitCommand.text.execute, 'function');
});
