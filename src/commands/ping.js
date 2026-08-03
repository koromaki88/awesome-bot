import { SlashCommandBuilder } from 'discord.js';

function formatPingResponse(roundTripMs, websocketMs) {
  return `Pong! \`${roundTripMs}ms\`, WebSocket: \`${websocketMs}ms\`.`;
}

export const pingCommand = {
  slash: {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Check the bot response time.'),

    async execute(interaction) {
      const startedAt = Date.now();
      await interaction.reply('Pinging...');

      const roundTripMs = Date.now() - startedAt;
      await interaction.editReply(formatPingResponse(roundTripMs, interaction.client.ws.ping));
    },
  },

  text: {
    name: 'ping',
    aliases: [],

    async execute(message) {
      const reply = await message.reply('Pinging...');
      const roundTripMs = reply.createdTimestamp - message.createdTimestamp;

      await reply.edit(formatPingResponse(roundTripMs, message.client.ws.ping));
    },
  },
};
