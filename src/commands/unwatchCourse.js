import { ChannelType, SlashCommandBuilder } from 'discord.js';

import { removeCourseSubscription } from '../db/subscriptions.js';

function parseChannelId(input) {
  return input?.match(/^<#(\d+)>$/)?.[1] ?? input;
}

function unwatchCourse({ guildId, channelId, courseId }) {
  return removeCourseSubscription({
    guildId,
    channelId,
    canvasCourseId: String(courseId),
  });
}

export const unwatchCourseCommand = {
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
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
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
          content: `No reminder subscription found for Canvas course ${courseId} in <#${channel.id}>.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `Stopped reminders for **${removed.course_name ?? `Course ${courseId}`}** in <#${channel.id}>.`,
        ephemeral: true,
      });
    },
  },

  text: {
    name: 'unwatchcourse',
    aliases: ['unwatch-course'],

    async execute(message, args) {
      if (!message.guildId) {
        await message.reply('This command can only be used in a server.');
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
        await message.reply(`No reminder subscription found for Canvas course ${courseId} in <#${channel.id}>.`);
        return;
      }

      await message.reply(`Stopped reminders for **${removed.course_name ?? `Course ${courseId}`}** in <#${channel.id}>.`);
    },
  },
};
