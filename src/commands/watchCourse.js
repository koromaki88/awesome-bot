import { ChannelType, SlashCommandBuilder } from 'discord.js';

import { createMissingRemindersForSubscription } from '../db/assignments.js';
import { upsertCourseSubscription } from '../db/subscriptions.js';
import { fetchCanvasCourse } from '../canvas/client.js';
import { permissionLevels } from '../permissions.js';
import { syncCourseAssignments } from '../canvas/syncAssignments.js';

const serverOnlyMessage = 'This command can only be used in a server.';

function requireCanvasConfig() {
  if (!process.env.CANVAS_BASE_URL || !process.env.CANVAS_ACCESS_TOKEN) {
    throw new Error('Canvas is not configured. Add CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN to .env.');
  }
}

function parseChannelId(input) {
  return input?.match(/^<#(\d+)>$/)?.[1] ?? input;
}

export async function subscribeToCourse({ guildId, channelId, courseId }) {
  requireCanvasConfig();

  const course = await fetchCanvasCourse(courseId);
  const subscription = upsertCourseSubscription({
    guildId,
    channelId,
    canvasCourseId: String(course.id),
    courseName: course.name ?? course.course_code ?? `Course ${course.id}`,
  });

  createMissingRemindersForSubscription(subscription);
  const assignmentCount = await syncCourseAssignments(subscription);

  return { subscription, assignmentCount };
}

export function formatWatchCourseResponse(subscription, assignmentCount) {
  return `Watching **${subscription.course_name}** in <#${subscription.channel_id}>. Synced ${assignmentCount} upcoming assignment(s).`;
}

export const watchCourseCommand = {
  permissions: { level: permissionLevels.privilegedUser },

  slash: {
    data: new SlashCommandBuilder()
      .setName('watchcourse')
      .setDescription('Send Canvas assignment reminders for a course to a channel.')
      .addStringOption((option) =>
        option
          .setName('course_id')
          .setDescription('The Canvas course ID to watch.')
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

      await interaction.deferReply({ ephemeral: true });

      const courseId = interaction.options.getString('course_id', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const { subscription, assignmentCount } = await subscribeToCourse({
        guildId: interaction.guildId,
        channelId: channel.id,
        courseId,
      });

      await interaction.editReply(formatWatchCourseResponse(subscription, assignmentCount));
    },
  },

  text: {
    name: 'watchcourse',
    aliases: ['watch-course'],

    async execute(message, args) {
      if (!message.guildId) {
        await message.reply(serverOnlyMessage);
        return;
      }

      const [courseId, channelInput] = args;
      if (!courseId) {
        await message.reply('Usage: `!watchcourse <canvasCourseId> [#channel]`');
        return;
      }

      const channelId = parseChannelId(channelInput) ?? message.channelId;
      const channel = await message.guild.channels.fetch(channelId).catch(() => null);

      if (!channel?.isTextBased()) {
        await message.reply('I could not find that text channel.');
        return;
      }

      const reply = await message.reply(`Setting up reminders for Canvas course ${courseId}...`);
      const { subscription, assignmentCount } = await subscribeToCourse({
        guildId: message.guildId,
        channelId: channel.id,
        courseId,
      });

      await reply.edit(formatWatchCourseResponse(subscription, assignmentCount));
    },
  },
};
