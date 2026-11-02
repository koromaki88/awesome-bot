# Awesome Bot

Personal Discord bot with Canvas announcements, assignment reminders, and personal DM reminders.

## Quick start

Configure `.env` using the [configuration guide](docs/configuration.md), then run:

```sh
npm ci
mkdir -p data
npm run deploy:commands
npm start
```

## Basic commands

- `!help` — browse commands using the interactive help menu.
- `!canvas watchlist` — list watched Canvas courses.
- `!canvas preview <course ID or name>` — preview a course announcement.
- `!remindme 3d2h5m Do something` — schedule a personal DM reminder.

Slash commands are also available. The default text prefix is `!`.

## Documentation

- [Configuration](docs/configuration.md) — environment variables and Canvas access.
- [Commands](docs/commands.md) — usage, permissions, and examples.
- [Development](docs/development.md) — watch mode and local tests.
- [Deployment](docs/deployment.md) — Podman builds, logs, and database storage.
