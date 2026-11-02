# Local development

[Back to README](../README.md)

Install dependencies with `npm ci` and configure [environment variables](configuration.md).
Node 22 matches the container's runtime.

## Watch mode

```sh
npm run dev
```

The bot restarts when source files change. There is no need to run the full build
script for every edit. If a container uses the same bot token, stop it first to
avoid duplicate responses:

```sh
podman stop awesome-bot
```

For isolated testing, use a separate development bot/token, test server, and database:

```sh
mkdir -p "$HOME/.local/share/awesome-bot-dev"
DATABASE_PATH="$HOME/.local/share/awesome-bot-dev/bot.sqlite" npm run dev
```

A fresh database has no watched courses. Add development subscriptions with
`!canvas watch`, or use `!canvas preview <course_id>` without a subscription.

## Tests

Run all tests without logging into Discord or making live Canvas calls:

```sh
npm test
```

Run a single test file while working on a feature:

```sh
node --test test/canvas/announcementDelivery.test.js
```

`npm run check` also runs the test suite. Only run `npm run deploy:commands` when
slash-command metadata changes; see [configuration](configuration.md).

## Read-only database after using Podman

The deployment script uses a `:U` volume mount, which can change `data/` ownership
to the container user. SQLite needs write access to both its database files and
their containing directory.

With the container stopped, rootless Podman users can reclaim the local data directory:

```sh
podman unshare chown -R 0:0 ./data
chmod -R u+rwX ./data
```

Inside `podman unshare`, `0:0` maps to your normal host user. Running the build
script again may change ownership back. A separate development database avoids
this conflict without modifying production files.
