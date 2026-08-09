import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = join(await mkdtemp(join(tmpdir(), 'awesome-bot-registry-')), 'bot.sqlite');

const { commands } = await import('../../src/commands/registry.js');

/*
 * Verifies the public command registry exposes the expected user-facing commands.
 */
test('registry includes the expected commands', () => {
  const slashNames = commands.filter((command) => command.slash).map((command) => command.slash.data.toJSON().name);
  const textNames = commands.filter((command) => command.text).map((command) => command.text.name);

  assert.deepEqual(slashNames.sort(), ['canvas', 'commit', 'ping']);
  assert.deepEqual(textNames.sort(), ['canvas', 'commit', 'ping']);
});

/*
 * Verifies every registered command can be invoked through at least one Discord interface.
 */
test('every registered command has slash or text support', () => {
  for (const command of commands) {
    assert.ok(command.slash || command.text);
  }
});

/*
 * Verifies slash command builders serialize into valid Discord command payloads.
 */
test('slash commands expose Discord command JSON', () => {
  for (const command of commands.filter((registeredCommand) => registeredCommand.slash)) {
    const json = command.slash.data.toJSON();

    assert.equal(typeof json.name, 'string');
    assert.notEqual(json.name, '');
    assert.equal(typeof json.description, 'string');
    assert.notEqual(json.description, '');
  }
});
