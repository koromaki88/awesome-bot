import { SlashCommandBuilder } from 'discord.js';

function greetingFor(target) {
  return `Hello, ${target}!`;
}

export const greetCommand = {
  slash: {
    data: new SlashCommandBuilder()
      .setName('greet')
      .setDescription('Send a friendly greeting.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The person to greet.')
          .setRequired(false),
      ),

    async execute(interaction) {
      const user = interaction.options.getUser('user') ?? interaction.user;

      await interaction.reply(greetingFor(user));
    },
  },

  text: {
    name: 'greet',
    aliases: ['hello', 'hi'],

    async execute(message, args) {
      const target = args.join(' ') || message.author.toString();

      await message.reply(greetingFor(target));
    },
  },
};
