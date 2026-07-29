import 'dotenv/config';
import { REST, Routes } from 'discord.js';

import { commands } from './commands/registry.js';

const { APP_ID, CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env;
const applicationId = APP_ID ?? CLIENT_ID;

if (!applicationId || !DISCORD_TOKEN) {
  throw new Error('Missing APP_ID/CLIENT_ID or DISCORD_TOKEN in your environment.');
}

const slashCommands = commands
  .filter((command) => command.slash)
  .map((command) => command.slash.data.toJSON());
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

if (GUILD_ID) {
  await rest.put(Routes.applicationGuildCommands(applicationId, GUILD_ID), { body: slashCommands });
  console.log('Registered guild slash commands.');
} else {
  await rest.put(Routes.applicationCommands(applicationId), { body: slashCommands });
  console.log('Registered global slash commands.');
}
