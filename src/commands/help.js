import {
  ActionRowBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

export const helpSelectCustomId = 'help:category';

const categories = [
  {
    id: 'general',
    number: 1,
    name: 'General',
    emoji: '🤖',
    description: 'Bot information, status, and help commands.',
    commands(prefix) {
      return [
        {
          name: 'Help',
          value: `\`${prefix}help [category]\` or \`/help [category]\`\nOpen this menu or jump directly to a category.`,
        },
        {
          name: 'Ping',
          value: `\`${prefix}ping\` or \`/ping\`\nCheck the bot's response time.`,
        },
        {
          name: 'Personal reminder',
          value: `\`${prefix}remindme <duration> <message>\`\n\`/remindme duration:<duration> message:<message>\`\nSchedule a DM reminder. Example duration: \`3d2h5m\`.`,
        },
        {
          name: 'Commit',
          value: `\`${prefix}commit\` or \`/commit\`\nCheck whether the running bot is up to date with GitHub. Aliases: \`${prefix}version\`, \`${prefix}sha\`.`,
        },
      ];
    },
  },
  {
    id: 'canvas',
    number: 2,
    name: 'Canvas',
    emoji: '📚',
    description: 'Manage Canvas course reminders and announcements. These commands are limited to approved users.',
    commands(prefix) {
      return [
        {
          name: 'Watch a course',
          value: `\`${prefix}canvas watch <course_id> [#channel]\`\n\`/canvas watch course_id:<id> [channel]\`\nSend assignment reminders for a course to a channel.`,
        },
        {
          name: 'Stop watching',
          value: `\`${prefix}canvas unwatch <course_id> [#channel]\`\n\`/canvas unwatch course_id:<id> [channel]\`\nStop reminders for a course in a channel.`,
        },
        {
          name: 'Watchlist',
          value: `\`${prefix}canvas watchlist\` or \`/canvas watchlist\`\nList the Canvas courses watched in this server.`,
        },
        {
          name: 'Sync',
          value: `\`${prefix}canvas sync\` or \`/canvas sync\`\nSync assignments for watched courses now.`,
        },
        {
          name: 'Preview announcements',
          value: `\`${prefix}canvas preview <course_id> [position]\`\n\`/canvas preview course_id:<id> [position]\`\nPreview one of the 10 most recent course announcements.`,
        },
      ];
    },
  },
];

function getPrefix() {
  return process.env.BOT_PREFIX ?? '!';
}

function findCategory(input) {
  const normalized = input?.trim().toLowerCase();
  return categories.find(
    (category) => category.id === normalized || String(category.number) === normalized,
  );
}

function buildCategoryMenu(selectedCategoryId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(helpSelectCustomId)
    .setPlaceholder('Choose a command category')
    .addOptions(
      categories.map((category) => ({
        label: `${category.number}. ${category.name}`,
        description: category.description.slice(0, 100),
        value: category.id,
        emoji: category.emoji,
        default: category.id === selectedCategoryId,
      })),
    );

  return new ActionRowBuilder().addComponents(menu);
}

function buildOverviewEmbed() {
  const prefix = getPrefix();

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Awesome Bot Help')
    .setDescription('Select a category below to see its commands and examples.')
    .addFields(
      categories.map((category) => ({
        name: `${category.number}. ${category.emoji} ${category.name}`,
        value: category.description,
      })),
    )
    .setFooter({ text: `You can also use ${prefix}help <category> (for example, ${prefix}help canvas).` });
}

function buildCategoryEmbed(category) {
  const prefix = getPrefix();

  return new EmbedBuilder()
    .setColor(category.id === 'canvas' ? 0xe13f29 : 0x5865f2)
    .setTitle(`${category.emoji} ${category.number}. ${category.name} Commands`)
    .setDescription(category.description)
    .addFields(category.commands(prefix))
    .setFooter({ text: `Use ${prefix}help to return to the category list.` });
}

export function createHelpPayload(categoryInput) {
  const category = findCategory(categoryInput);

  return {
    embeds: [category ? buildCategoryEmbed(category) : buildOverviewEmbed()],
    components: [buildCategoryMenu(category?.id)],
  };
}

async function handleHelpSelect(interaction) {
  await interaction.update(createHelpPayload(interaction.values[0]));
}

export const helpCommand = {
  slash: {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Browse the bot commands and usage examples.')
      .addStringOption((option) =>
        option
          .setName('category')
          .setDescription('Open a specific command category.')
          .setRequired(false)
          .addChoices(...categories.map((category) => ({ name: category.name, value: category.id }))),
      ),

    async execute(interaction) {
      await interaction.reply(createHelpPayload(interaction.options.getString('category')));
    },
  },

  text: {
    name: 'help',
    aliases: ['commands'],

    async execute(message, args) {
      await message.reply(createHelpPayload(args[0]));
    },
  },

  components: [{ customId: helpSelectCustomId, execute: handleHelpSelect }],
};
