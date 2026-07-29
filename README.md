# Awesome Bot

A small Discord bot using `discord.js`.

## Directory Map

```text
awesome-bot/
├── src/
│   ├── index.js              # Discord client, event listeners, command routing
│   ├── deploy-commands.js    # Registers slash commands with Discord
│   ├── commands/
│   │   ├── registry.js       # Exports the command list
│   │   ├── greet.js          # /greet and !greet command behavior
│   │   ├── watchCourse.js    # Canvas course reminder subscription command
│   │   └── unwatchCourse.js  # Removes Canvas reminder subscriptions
│   ├── canvas/               # Canvas API client and assignment sync
│   ├── db/                   # SQLite schema and query helpers
│   ├── reminders/            # Reminder scheduler and Discord messages
│   └── events/               # Optional future home for separate event files
├── data/                     # Local SQLite database files
├── assets/                   # Images, sounds, or static bot assets
├── Dockerfile
├── docker-compose.yml
├── awesome-bot.container     # Podman Quadlet systemd unit
├── .env                      # Local secrets, not committed
├── .gitignore
└── package.json
```

## Environment

Create a `.env` with:

```env
DISCORD_TOKEN=your_bot_token
APP_ID=your_application_id
GUILD_ID=your_test_server_id
BOT_PREFIX=!
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_access_token
DATABASE_PATH=data/bot.sqlite
```

`GUILD_ID` is optional, but useful while developing because guild slash commands update faster than global commands.

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
docker compose build
docker compose run --rm bot npm run deploy:commands
docker compose up -d
```

View logs:

```sh
docker compose logs -f bot
```

Stop the bot:

```sh
docker compose down
```

Run with Podman:

```sh
podman build -t awesome-bot:latest .
podman run --rm --env-file .env -e DATABASE_PATH=data/bot.sqlite -v ./data:/app/data:Z,U awesome-bot:latest npm run deploy:commands
podman run -d --name awesome-bot --restart=unless-stopped --env-file .env -e DATABASE_PATH=data/bot.sqlite -v ./data:/app/data:Z,U awesome-bot:latest
```

View Podman logs:

```sh
podman logs -f awesome-bot
```

Stop the Podman container:

```sh
podman stop awesome-bot
podman rm awesome-bot
```

Run with Podman Quadlet/systemd:

```sh
podman build -t awesome-bot:latest .
mkdir -p ~/.config/containers/systemd
cp awesome-bot.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user enable --now awesome-bot.service
```

The included `awesome-bot.container` assumes this project lives at `~/awesome-bot`. If your server path is different, update `EnvironmentFile=` and `Volume=` in that file before copying it.

Quadlet logs:

```sh
journalctl --user -u awesome-bot.service -f
```

Try these in Discord:

```text
/greet
/greet user:@someone
!greet
!greet everyone
!hello
!hi
/watchcourse course_id:12345
!watchcourse 12345
!watchcourse 12345 #assignments
/unwatchcourse course_id:12345
!unwatchcourse 12345
!unwatchcourse 12345 #assignments
```

`watchcourse` stores the Discord channel and Canvas course ID in SQLite. The bot syncs subscribed Canvas courses every 6 hours and checks for reminders every 10 minutes.

Assignment reminders are sent 7, 5, 3, and 1 day before the Canvas due date.

When running in Docker or Podman, the SQLite database is stored on the host in `./data` and mounted into the container at `/app/data`.
