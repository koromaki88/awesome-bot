import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { permissionLevels } from '../permissions.js';

const maxPurgeCount = 100;
const maxMessageAgeMs = 14 * 24 * 60 * 60 * 1000;
const requiredBotPermissions = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
];

export function parsePurgeCount(input) {
  if (typeof input === 'string' && !/^\d+$/.test(input)) return null;
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const count = Number(input);
  return Number.isInteger(count) && count >= 1 && count <= maxPurgeCount ? count : null;
}

function usageMessage() {
  return `Usage: \`${process.env.BOT_PREFIX ?? '!'}purge <1-${maxPurgeCount}>\`.`;
}

function checkChannel(guildId, channel, permissions) {
  if (!guildId) return 'This command can only be used in a server.';
  if (!channel?.messages?.fetch || typeof channel.bulkDelete !== 'function') {
    return 'I cannot purge messages in this channel.';
  }
  if (!permissions?.has(requiredBotPermissions)) {
    return 'I need View Channel, Read Message History, and Manage Messages permissions in this channel.';
  }
  return null;
}

async function purgeMessages(channel, count, before) {
  // Anchor the fetch before the invocation so the command and any messages sent
  // while the purge is running never consume the requested count.
  const messages = await channel.messages.fetch({ limit: count, before, cache: false });
  const cutoff = Date.now() - maxMessageAgeMs;
  const recent = messages.filter((message) => message.createdTimestamp > cutoff);
  if (recent.size === 1) {
    await recent.first().delete();
  } else if (recent.size > 1) {
    await channel.bulkDelete(recent, true);
  }
}

export const purgeCommand = {
  permissions: { level: permissionLevels.serverAdmin },

  slash: {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('Delete up to 100 recent messages in this channel. Server admins only.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setContexts(InteractionContextType.Guild)
      .addIntegerOption((option) =>
        option.setName('count')
          .setDescription('Number of messages to delete (1–100).')
          .setMinValue(1)
          .setMaxValue(maxPurgeCount)
          .setRequired(true),
      ),

    async execute(interaction) {
      const error = checkChannel(interaction.guildId, interaction.channel, interaction.appPermissions);
      if (error) {
        await interaction.reply({ content: error, ephemeral: true });
        return;
      }
      const count = parsePurgeCount(interaction.options.getInteger('count', true));
      if (count === null) {
        await interaction.reply({ content: usageMessage(), ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await purgeMessages(interaction.channel, count, interaction.id);
      await interaction.deleteReply();
    },
  },

  text: {
    name: 'purge',
    aliases: [],

    async execute(message, args) {
      const permissions = message.guildId ? message.channel.permissionsFor(message.client.user) : null;
      const error = checkChannel(message.guildId, message.channel, permissions);
      if (error) {
        await message.reply(error);
        return;
      }
      const count = args.length === 1 ? parsePurgeCount(args[0]) : null;
      if (count === null) {
        await message.reply(usageMessage());
        return;
      }

      await purgeMessages(message.channel, count, message.id);
      try {
        await message.delete();
      } catch (error) {
        // It may already have been removed by another moderator.
        if (error.code !== 10008) {
          console.error('Could not remove purge command message:', error);
          await message.reply('Messages were purged, but I could not remove the purge command message.');
        }
      }
    },
  },
};
