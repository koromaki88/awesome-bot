import { SlashCommandBuilder } from 'discord.js';

import { createPersonalReminder } from '../db/personalReminders.js';

const usageMessage = 'Usage: `!remindme <duration> <message>` (example: `!remindme 3d2h5m I want to do something`)';
const maxReminderMessageLength = 1986;

export function parseReminderDuration(input) {
  if (!input) return null;

  const pattern = /(\d+)([dhm])/gi;
  let matchedLength = 0;
  let durationMs = 0;
  let match;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index !== matchedLength) return null;

    const amount = Number(match[1]);
    const unitMs = { d: 24 * 60 * 60 * 1000, h: 60 * 60 * 1000, m: 60 * 1000 }[match[2].toLowerCase()];
    durationMs += amount * unitMs;
    matchedLength = pattern.lastIndex;
  }

  if (matchedLength !== input.length || durationMs <= 0 || !Number.isSafeInteger(durationMs)) return null;
  return durationMs;
}

function validateReminder(durationInput, reminderMessage) {
  const durationMs = parseReminderDuration(durationInput);
  if (!durationMs || !reminderMessage || reminderMessage.length > maxReminderMessageLength) return null;

  const remindAt = new Date(Date.now() + durationMs);
  if (Number.isNaN(remindAt.getTime())) return null;

  return remindAt;
}

function confirmationMessage(remindAt) {
  const timestamp = Math.floor(remindAt.getTime() / 1000);
  return `Okay, I'll DM you a reminder <t:${timestamp}:R>.`;
}

async function scheduleReminder({ userId, durationInput, reminderMessage }) {
  const remindAt = validateReminder(durationInput, reminderMessage);
  if (!remindAt) return null;

  createPersonalReminder({
    userId,
    message: reminderMessage,
    remindAt: remindAt.toISOString(),
  });

  return confirmationMessage(remindAt);
}

export const remindmeCommand = {
  slash: {
    data: new SlashCommandBuilder()
      .setName('remindme')
      .setDescription('Schedule a personal reminder by DM.')
      .addStringOption((option) =>
        option
          .setName('duration')
          .setDescription('When to remind you, such as 3d2h5m, 2h, or 15m.')
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('What you want to be reminded about.')
          .setMaxLength(maxReminderMessageLength)
          .setRequired(true),
      ),

    async execute(interaction) {
      const response = await scheduleReminder({
        userId: interaction.user.id,
        durationInput: interaction.options.getString('duration', true),
        reminderMessage: interaction.options.getString('message', true).trim(),
      });

      await interaction.reply({ content: response ?? usageMessage, ephemeral: true });
    },
  },

  text: {
    name: 'remindme',
    aliases: ['remind'],

    async execute(message, args) {
      const [durationInput, ...messageParts] = args;
      const response = await scheduleReminder({
        userId: message.author.id,
        durationInput,
        reminderMessage: messageParts.join(' ').trim(),
      });

      await message.reply(response ?? usageMessage);
    },
  },
};
