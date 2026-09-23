import { SlashCommandBuilder } from 'discord.js';

import { createPersonalReminder } from '../db/personalReminders.js';

const usageMessage = 'Usage: `!remindme <duration> <message>` (units: `mo`, `w`, `d`, `h`, `m`, `s`)';
const maxReminderMessageLength = 1986;

export function parseReminderDuration(input) {
  if (!input) return null;

  const pattern = /(\d+)(mo|[wdhms])/gi;
  let matchedLength = 0;
  let calendarMonths = 0;
  let elapsedMs = 0;
  let match;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index !== matchedLength) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'mo') {
      calendarMonths += amount;
    } else {
      const unitMs = {
        w: 7 * 24 * 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        h: 60 * 60 * 1000,
        m: 60 * 1000,
        s: 1000,
      }[unit];
      elapsedMs += amount * unitMs;
    }

    matchedLength = pattern.lastIndex;
  }

  if (
    matchedLength !== input.length
    || calendarMonths + elapsedMs <= 0
    || !Number.isSafeInteger(calendarMonths)
    || !Number.isSafeInteger(elapsedMs)
  ) return null;

  return { calendarMonths, elapsedMs };
}

export function calculateReminderDate(input, start = new Date(Date.now())) {
  const duration = parseReminderDuration(input);
  if (!duration || Number.isNaN(start.getTime())) return null;

  const remindAt = new Date(start);

  if (duration.calendarMonths > 0) {
    const originalDay = remindAt.getUTCDate();
    remindAt.setUTCDate(1);
    remindAt.setUTCMonth(remindAt.getUTCMonth() + duration.calendarMonths);

    const lastDayOfTargetMonth = new Date(Date.UTC(
      remindAt.getUTCFullYear(),
      remindAt.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    remindAt.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  }

  remindAt.setTime(remindAt.getTime() + duration.elapsedMs);
  return Number.isNaN(remindAt.getTime()) ? null : remindAt;
}

function validateReminder(durationInput, reminderMessage) {
  if (!reminderMessage || reminderMessage.length > maxReminderMessageLength) return null;

  return calculateReminderDate(durationInput);
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
          .setDescription('When: mo, w, d, h, m, s (for example, 1mo2w3d4h5m6s).')
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
