import { ChannelType, SlashCommandBuilder } from 'discord.js';

import { removeCourseSubscription } from '../db/subscriptions.js';
import { permissionLevels } from '../permissions.js';

const serverOnlyMessage = 'This command can only be used in a server.';

function parseChannelId(input) {
  return input?.match(/^<#(\d+)>$/)?.[1] ?? input;
}

export function unwatchCourse({ guildId, channelId, courseId }) {
  return removeCourseSubscription({
    guildId,
    channelId,
    canvasCourseId: String(courseId),
  });
}

export function formatNoSubscriptionMessage(courseId, channelId) {
  return `No reminder subscription found for Canvas course ${courseId} in <#${channelId}>.`;
}

export function formatUnwatchCourseResponse(removed, courseId, channelId) {
  return `Stopped reminders for **${removed.course_name ?? `Course ${courseId}`}** in <#${channelId}>.`;
}

export const unwatchCourseCommand = {
  permissions: { level: permissionLevels.privilegedUser },

  slash: {
    data: new SlashCommandBuilder()
      .setName('unwatchcourse')
      .setDescription('Stop Canvas assignment reminders for a course in a channel.')
      .addStringOption((option) =>
        option
          .setName('course_id')
          .setDescription('The Canvas course ID to stop watching.')
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The reminder channel. Defaults to this channel.')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false),
      ),

    async execute(interaction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: serverOnlyMessage, ephemeral: true });
        return;
      }

      const courseId = interaction.options.getString('course_id', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const removed = unwatchCourse({
        guildId: interaction.guildId,
        channelId: channel.id,
        courseId,
      });

      if (!removed) {
        await interaction.reply({
          content: formatNoSubscriptionMessage(courseId, channel.id),
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: formatUnwatchCourseResponse(removed, courseId, channel.id),
        ephemeral: true,
      });
    },
  },

  text: {
    name: 'unwatchcourse',
    aliases: ['unwatch-course'],

    async execute(message, args) {
      if (!message.guildId) {
        await message.reply(serverOnlyMessage);
        return;
      }

      const [courseId, channelInput] = args;
      if (!courseId) {
        await message.reply('Usage: `!unwatchcourse <canvasCourseId> [#channel]`');
        return;
      }

      const channelId = parseChannelId(channelInput) ?? message.channelId;
      const channel = await message.guild.channels.fetch(channelId).catch(() => null);

      if (!channel?.isTextBased()) {
        await message.reply('I could not find that text channel.');
        return;
      }

      const removed = unwatchCourse({
        guildId: message.guildId,
        channelId: channel.id,
        courseId,
      });

      if (!removed) {
        await message.reply(formatNoSubscriptionMessage(courseId, channel.id));
        return;
      }

      await message.reply(formatUnwatchCourseResponse(removed, courseId, channel.id));
    },
  },
};
