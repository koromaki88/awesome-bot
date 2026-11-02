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

Use `/help` or `!help` for an interactive command list. Select a category from the dropdown,
or open one directly with a command such as `!help canvas`. `!canvas` and `!canvas help`
also open the Canvas command guide.

`!canvas watchlist` and `!canvas preview` (and their slash equivalents) are available to all server members.
Other Canvas commands remain restricted to approved users.

Preview accepts a course ID or the closest matching course name watched in the current
channel (case-insensitive, with partial names and typo tolerance). For example,
`!canvas preview operating systems 2` previews the second newest announcement. Quote
names ending in a number: `!canvas preview "Biology 101" 2`. Ambiguous matches ask for
a more specific name or course ID. The slash command's `course_id` option accepts
either an ID or a name as well.

Canvas announcements use Components V2 cards to keep text and images together without
narrowing the text around small images. Long announcements and galleries exceeding
10 images continue in additional cards.

Schedule a personal DM reminder with `!remindme 3d2h5m I want to do something`, or use
`/remindme`. Durations can combine calendar months (`mo`), weeks (`w`), days (`d`),
hours (`h`), minutes (`m`), and seconds (`s`). Calendar months preserve the day of the
month when possible, or use the target month's last day when necessary.

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
