# Commands

[Back to README](../README.md)

Examples use the default `!` prefix. Set `BOT_PREFIX` to change it. Slash equivalents
are available in Discord.

## Help and bot information

| Command | Purpose |
| --- | --- |
| `!help` | Open the interactive category menu. |
| `!help canvas` or `!help 2` | Open the Canvas command guide directly. |
| `!commands` | Alias for `!help`. |
| `!ping` | Check the bot's response time. |
| `!commit` | Compare the running bot's commit against GitHub. Aliases: `!version`, `!sha`. |

The help menu dropdown switches between General and Canvas commands. `!canvas` and
`!canvas help` also open the Canvas guide, subject to Canvas command permissions.

## Canvas

Canvas commands are server-only. **Watchlist and preview are available to all server
members.** Other Canvas commands require an ID in `APPROVED_USER_IDS`.

| Command | Purpose |
| --- | --- |
| `!canvas watch <course_id> [#channel]` | Watch a course and send assignment reminders to a channel. |
| `!canvas unwatch <course_id> [#channel]` | Stop watching a course in a channel. |
| `!canvas watchlist` | List courses watched in the server. |
| `!canvas sync` | Sync watched courses now. |
| `!canvas preview <course ID or name> [position]` | Preview one of the 10 most recent course announcements. |

For watch and unwatch, omitting `#channel` uses the current channel.

### Preview by name

Preview accepts either a numeric course ID or the closest matching course name
watched in the **current channel**. Name matching is case-insensitive and supports
partial names and typos. Ambiguous matches ask for a more specific name or course ID.

```text
!canvas preview 12345
!canvas preview operating systems
!canvas preview operatng systems 2
!canvas preview "Biology 101" 2
```

The optional position defaults to `1` (newest) and accepts values from `1` to `10`.
Quote names ending in a number so the number is not interpreted as a position.
The slash command's `course_id` option accepts either an ID or a name as well.

### Announcement layout

Canvas announcements use Components V2 cards to keep text and images together
without narrowing the text around small images. Long announcements and galleries
exceeding 10 images continue in additional cards.

## Personal reminders

```text
!remindme 3d2h5m I want to do something
```

Use `!remindme <duration> <message>` or `/remindme`. `!remind` is a text-command alias.
Durations can combine these units:

| Unit | Meaning |
| --- | --- |
| `mo` | Calendar months |
| `w` | Weeks |
| `d` | Days |
| `h` | Hours |
| `m` | Minutes |
| `s` | Seconds |

Calendar months preserve the day of the month when possible, or use the target
month's final day when necessary. For example, January 31 + `1mo` becomes February
28 or 29.

Reminders persist across restarts and are checked every second. When due, the bot
sends a DM in this format:

> **Reminder**: I want to do something

Make sure your Discord privacy settings allow DMs from the bot.
