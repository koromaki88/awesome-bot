# Deployment

[Back to README](../README.md)

Configure [environment variables](configuration.md) before starting the bot.

## Run directly

```sh
npm ci
mkdir -p data
npm run deploy:commands
npm start
```

For faster edit-and-test cycles, use [local development](development.md) instead.

## Deploy with Podman

```sh
./build.sh
```

The script:

1. Updates the project using `git pull --ff-only`.
2. Writes `src/version.json` with the current Git commit.
3. Builds a temporary test image and runs the test suite inside Podman.
4. Builds the production image and registers slash commands.
5. Replaces the running `awesome-bot` container only after tests pass.
6. Prunes dangling images.

The `commit` command uses the version file to compare the running bot against the
latest commit on GitHub.

### Container management

View logs:

```sh
podman logs -f awesome-bot
```

Stop the bot:

```sh
podman stop awesome-bot
```

### Database storage

The script stores the SQLite database on the host in `./data`, mounted into the
container at `/app/data`. This keeps reminders, subscriptions, and announcement
delivery records across container replacements. Keep this directory when redeploying.

The volume uses `:Z,U` for SELinux labeling and container ownership. If you later
run the bot outside the container, see the [local database permissions guide](development.md#read-only-database-after-using-podman).
