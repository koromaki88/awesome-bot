# Awesome Bot

Discord bot for personal use

## Environment

Create a `.env` with:

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

`GUILD_ID` is optional, but useful while developing because guild slash commands update faster than global commands.

`APPROVED_USER_IDS` defines the privileged users who can execute certain internal commands.

Create a Canvas access token from Canvas account settings, then put it in `CANVAS_ACCESS_TOKEN`.

## Commands

Register slash commands:

```sh
npm run deploy:commands
```

Start the bot:

```sh
npm start
```

Run with Docker Compose:

```sh
npm run write:version
docker compose build
docker compose run --rm bot npm run deploy:commands
docker compose up -d
```

`npm run write:version` writes `src/version.json` with the current Git commit before building the container. The `commit` command uses that file to compare the running bot against the latest commit on GitHub.

View logs:

```sh
docker compose logs -f bot
```

Stop the bot:

```sh
docker compose down
```

View Podman logs:

```sh
podman logs -f awesome-bot
```

`watchcourse` stores the Discord channel and Canvas course ID in SQLite. The bot syncs subscribed Canvas courses every 6 hours and checks for reminders every 10 minutes.

Assignment reminders are sent 7, 5, 3, and 1 day before the Canvas due date.

When running in Docker or Podman, the SQLite database is stored on the host in `./data` and mounted into the container at `/app/data`.
