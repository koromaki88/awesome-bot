import { ChannelType, SlashCommandBuilder } from 'discord.js';

import { syncGuildSubscribedCourses } from '../canvas/syncAssignments.js';
import { getCourseSubscriptionsByGuild } from '../db/subscriptions.js';
import { permissionLevels } from '../permissions.js';
import { formatNoSubscriptionMessage, formatUnwatchCourseResponse, unwatchCourse } from './unwatchCourse.js';
import { formatWatchCourseResponse, subscribeToCourse } from './watchCourse.js';

const serverOnlyMessage = 'This command can only be used in a server.';
const usageMessage = 'Usage: `!canvas <watch|unwatch|watchlist|sync> [canvasCourseId] [#channel]`';

function requireCanvasConfig() {
  if (!process.env.CANVAS_BASE_URL || !process.env.CANVAS_ACCESS_TOKEN) {
    throw new Error('Canvas is not configured. Add CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN to .env.');
  }
}

function parseChannelId(input) {
  return input?.match(/^<#(\d+)>$/)?.[1] ?? input;
}

function formatWatchlist(subscriptions) {
  if (subscriptions.length === 0) {
    return 'No Canvas courses are being watched in this server.';
  }

  const lines = subscriptions.map((subscription) => {
    const courseName = subscription.course_name ?? `Course ${subscription.canvas_course_id}`;
    return `- **${courseName}** (${subscription.canvas_course_id}) in <#${subscription.channel_id}>`;
  });

  return ['Watched Canvas courses:', ...lines].join('\n');
}

function formatSyncResult(result) {
  return `Canvas sync complete: ${result.courses} course(s), ${result.assignments} assignment(s).`;
}

function getWatchlistMessage(guildId) {
  return formatWatchlist(getCourseSubscriptionsByGuild(guildId));
}

async function handleSlashWatch(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const courseId = interaction.options.getString('course_id', true);
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const { subscription, assignmentCount } = await subscribeToCourse({
    guildId: interaction.guildId,
    channelId: channel.id,
    courseId,
  });

  await interaction.editReply(formatWatchCourseResponse(subscription, assignmentCount));
}

async function handleSlashUnwatch(interaction) {
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
}

async function handleSlashWatchlist(interaction) {
  await interaction.reply({ content: getWatchlistMessage(interaction.guildId), ephemeral: true });
}

async function handleSlashSync(interaction) {
  requireCanvasConfig();
  await interaction.deferReply({ ephemeral: true });

  const result = await syncGuildSubscribedCourses(interaction.guildId);
  await interaction.editReply(formatSyncResult(result));
}

async function resolveTextChannel(message, channelInput) {
  const channelId = parseChannelId(channelInput) ?? message.channelId;
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  return channel?.isTextBased() ? channel : null;
}

async function handleTextWatch(message, args) {
  const [courseId, channelInput] = args;
  if (!courseId) {
    await message.reply(usageMessage);
    return;
  }

  const channel = await resolveTextChannel(message, channelInput);
  if (!channel) {
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
}

async function handleTextUnwatch(message, args) {
  const [courseId, channelInput] = args;
  if (!courseId) {
    await message.reply(usageMessage);
    return;
  }

  const channel = await resolveTextChannel(message, channelInput);
  if (!channel) {
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
}

async function handleTextWatchlist(message) {
  await message.reply(getWatchlistMessage(message.guildId));
}

async function handleTextSync(message) {
  requireCanvasConfig();
  const reply = await message.reply('Syncing watched Canvas courses...');

  const result = await syncGuildSubscribedCourses(message.guildId);
  await reply.edit(formatSyncResult(result));
}

export const canvasCommand = {
  permissions: { level: permissionLevels.privilegedUser },

  slash: {
    data: new SlashCommandBuilder()
      .setName('canvas')
      .setDescription('Manage Canvas course reminders.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('watch')
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
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('unwatch')
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
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('watchlist')
          .setDescription('List Canvas courses watched in this server.'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('sync')
          .setDescription('Sync assignments for watched Canvas courses now.'),
      ),

    async execute(interaction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: serverOnlyMessage, ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'watch') {
        await handleSlashWatch(interaction);
        return;
      }

      if (subcommand === 'unwatch') {
        await handleSlashUnwatch(interaction);
        return;
      }

      if (subcommand === 'watchlist') {
        await handleSlashWatchlist(interaction);
        return;
      }

      if (subcommand === 'sync') {
        await handleSlashSync(interaction);
      }
    },
  },

  text: {
    name: 'canvas',
    aliases: [],

    async execute(message, args) {
      if (!message.guildId) {
        await message.reply(serverOnlyMessage);
        return;
      }

      const [subcommandInput, ...subcommandArgs] = args;
      const subcommand = subcommandInput?.toLowerCase();

      if (subcommand === 'watch') {
        await handleTextWatch(message, subcommandArgs);
        return;
      }

      if (subcommand === 'unwatch') {
        await handleTextUnwatch(message, subcommandArgs);
        return;
      }

      if (subcommand === 'watchlist') {
        await handleTextWatchlist(message);
        return;
      }

      if (subcommand === 'sync') {
        await handleTextSync(message);
        return;
      }

      await message.reply(usageMessage);
    },
  },
};
