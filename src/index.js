import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

import { commands } from './commands/registry.js';
import { initializeSchema } from './db/schema.js';
import { startReminderScheduler } from './reminders/scheduler.js';

const prefix = process.env.BOT_PREFIX ?? '!';
initializeSchema();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const slashCommands = new Map(
  commands.filter((command) => command.slash).map((command) => [command.slash.data.name, command]),
);
const textCommands = new Map(
  commands
    .filter((command) => command.text)
    .flatMap((command) => [
      [command.text.name, command],
      ...command.text.aliases.map((alias) => [alias, command]),
    ]),
);

client.once('clientReady', () => {
  console.log(`Bot is online and logged in as ${client.user.tag}.`);
  startReminderScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = slashCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.slash.execute(interaction);
  } catch (error) {
    console.error(error);

    const response = { content: 'Something went wrong while running that command.', ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const [commandName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  if (!commandName) return;

  const command = textCommands.get(commandName.toLowerCase());
  if (!command) return;

  try {
    await command.text.execute(message, args);
  } catch (error) {
    console.error(error);
    await message.reply('Something went wrong while running that command.');
  }
});

await client.login(process.env.DISCORD_TOKEN);
