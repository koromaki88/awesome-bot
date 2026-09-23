import test from 'node:test';
import assert from 'node:assert/strict';

import { createHelpPayload, helpCommand, helpSelectCustomId } from '../../src/commands/help.js';

test('help command exposes slash and text metadata', () => {
  const slash = helpCommand.slash.data.toJSON();

  assert.equal(slash.name, 'help');
  assert.equal(slash.options[0].name, 'category');
  assert.deepEqual(slash.options[0].choices.map(({ name, value }) => ({ name, value })), [
    { name: 'General', value: 'general' },
    { name: 'Canvas', value: 'canvas' },
  ]);
  assert.equal(helpCommand.text.name, 'help');
  assert.deepEqual(helpCommand.text.aliases, ['commands']);
});

test('help overview lists numbered categories and provides a dropdown', () => {
  const payload = createHelpPayload();
  const embed = payload.embeds[0].toJSON();
  const menu = payload.components[0].toJSON().components[0];

  assert.equal(embed.title, 'Awesome Bot Help');
  assert.deepEqual(embed.fields.map((field) => field.name), ['1. 🤖 General', '2. 📚 Canvas']);
  assert.equal(menu.custom_id, helpSelectCustomId);
  assert.deepEqual(menu.options.map((option) => option.value), ['general', 'canvas']);
});

test('help category can be selected by name or number', () => {
  assert.equal(createHelpPayload('canvas').embeds[0].toJSON().title, '📚 2. Canvas Commands');
  assert.equal(createHelpPayload('2').embeds[0].toJSON().title, '📚 2. Canvas Commands');
});

test('help dropdown updates the original help message', async () => {
  let updatedPayload;
  const component = helpCommand.components.find(({ customId }) => customId === helpSelectCustomId);
  const fakeInteraction = {
    values: ['canvas'],
    async update(payload) {
      updatedPayload = payload;
    },
  };

  await component.execute(fakeInteraction);

  assert.equal(updatedPayload.embeds[0].toJSON().title, '📚 2. Canvas Commands');
});
