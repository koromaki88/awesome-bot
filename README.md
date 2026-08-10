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

Deploy with Podman:

```sh
./build.sh
```

`./build.sh` updates the project, writes `src/version.json` with the current Git commit, builds a temporary test image, runs the test suite inside Podman, builds the production image, deploys slash commands, and replaces the running bot container only after tests pass. The `commit` command uses that version file to compare the running bot against the latest commit on GitHub.

View logs:

```sh
podman logs -f awesome-bot
```

Stop the bot:

```sh
podman stop awesome-bot
```

When running in Docker or Podman, the SQLite database is stored on the host in `./data` and mounted into the container at `/app/data`.
