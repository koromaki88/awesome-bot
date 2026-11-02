# Configuration

[Back to README](../README.md)

Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token
APP_ID=your_application_id
GUILD_ID=your_test_server_id
BOT_PREFIX=!
APPROVED_USER_IDS=comma_separated_discord_user_ids
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_access_token
DATABASE_PATH=data/bot.sqlite
```

- `DISCORD_TOKEN`: the Discord bot token. Do not commit or share it.
- `APP_ID`: the Discord application ID used to register slash commands.
- `GUILD_ID`: optional test server ID. Guild slash commands update faster than global commands; omit it for global registration.
- `BOT_PREFIX`: text command prefix; defaults to `!`.
- `APPROVED_USER_IDS`: comma-separated Discord user IDs allowed to execute privileged commands. See [command permissions](commands.md#canvas).
- `CANVAS_BASE_URL`: your school's Canvas URL.
- `CANVAS_ACCESS_TOKEN`: create an access token in your Canvas account settings. Required for Canvas API features.
- `DATABASE_PATH`: SQLite database path; defaults to `data/bot.sqlite`. Its parent directory must exist and be writable.

Enable the **Message Content Intent** in the Discord Developer Portal for prefix commands.

Register slash commands after configuring the application ID and token:

```sh
npm run deploy:commands
```

Rerun registration when adding or changing slash-command names, descriptions, or options.
Ordinary behavior and formatting changes only require restarting the bot.
