import { ChannelType, SlashCommandBuilder } from 'discord.js';

import { sendPendingAnnouncements } from '../../canvas/announcementDelivery.js';
import { permissionLevels } from '../../permissions.js';
import { formatPreviewResult, parsePreviewPosition, previewCourseAnnouncement, previewUsageMessage } from './preview.js';
import { formatSyncResult, syncGuildCanvasCourses } from './sync.js';
import { canvasServerOnlyMessage, canvasUsageMessage, requireCanvasConfig, resolveTextChannel } from './shared.js';
import { getWatchlistMessage } from './watchlist.js';
import { formatNoSubscriptionMessage, formatUnwatchCourseResponse, unwatchCourse } from './unwatchCourse.js';
import { formatWatchCourseResponse, subscribeToCourse } from './watchCourse.js';

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

  const result = await syncGuildCanvasCourses(interaction.guildId);
  await sendPendingAnnouncements(interaction.client, { guildId: interaction.guildId });
  await interaction.editReply(formatSyncResult(result));
}

async function handleSlashPreview(interaction) {
  requireCanvasConfig();
  await interaction.deferReply({ ephemeral: true });

  const courseId = interaction.options.getString('course_id', true);
  const position = interaction.options.getInteger('position') ?? 1;
  const sent = await previewCourseAnnouncement({
    courseId,
    position,
    channel: interaction.channel,
  });

  await interaction.editReply(formatPreviewResult(sent, position));
}

async function handleTextWatch(message, args) {
  const [courseId, channelInput] = args;
  if (!courseId) {
    await message.reply(canvasUsageMessage);
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
    await message.reply(canvasUsageMessage);
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

  const result = await syncGuildCanvasCourses(message.guildId);
  await sendPendingAnnouncements(message.client, { guildId: message.guildId });
  await reply.edit(formatSyncResult(result));
}

async function handleTextPreview(message, args) {
  const [courseId, positionInput] = args;
  const position = parsePreviewPosition(positionInput);
  if (!courseId || position === null) {
    await message.reply(previewUsageMessage);
    return;
  }

  requireCanvasConfig();

  const reply = await message.reply(`Previewing Canvas announcement ${position} for course ${courseId}...`);
  const sent = await previewCourseAnnouncement({
    courseId,
    position,
    channel: message.channel,
  });

  await reply.edit(formatPreviewResult(sent, position));
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
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('preview')
          .setDescription('Preview recent Canvas announcements in this channel without saving delivery state.')
          .addStringOption((option) =>
            option
              .setName('course_id')
              .setDescription('The Canvas course ID to preview announcements from.')
              .setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName('position')
              .setDescription('Which recent announcement to preview: 1 is newest, 2 is next newest. Defaults to 1.')
              .setMinValue(1)
              .setMaxValue(10)
              .setRequired(false),
          ),
      ),

    async execute(interaction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: canvasServerOnlyMessage, ephemeral: true });
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
        return;
      }

      if (subcommand === 'preview') {
        await handleSlashPreview(interaction);
      }
    },
  },

  text: {
    name: 'canvas',
    aliases: [],

    async execute(message, args) {
      if (!message.guildId) {
        await message.reply(canvasServerOnlyMessage);
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

      if (subcommand === 'preview') {
        await handleTextPreview(message, subcommandArgs);
        return;
      }

      await message.reply(canvasUsageMessage);
    },
  },
};
