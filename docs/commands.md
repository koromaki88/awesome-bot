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

The help menu dropdown switches between General, Canvas, and Server Admin commands.
Use `!help admin` or `!help 3` for server administration commands. `!canvas` and
`!canvas help` also open the Canvas guide, subject to Canvas command permissions.

## Server Admin

`!purge <count>` deletes the last 1–100 messages **before the command** in the current
channel. The `!purge` message is removed separately and does not count toward the total.
Messages arriving after the command are not included.

```text
!purge 25
```

Only members with Discord's **Administrator** permission can use this command;
being an approved Canvas user or having only Manage Messages is not sufficient.
The bot needs **View Channel**, **Read Message History**, and **Manage Messages**
in the target channel.

Messages at least 14 days old are skipped because of Discord's bulk-delete limit.
The command does not fetch additional messages to replace skipped ones. Deleted
messages cannot be recovered.

The slash equivalent is `/purge count:25`. Successful purges are silent: the text
command posts no confirmation, and the slash command removes its temporary private
acknowledgement. Invalid input, permission problems, and failures still report errors.

## Canvas

Canvas commands are server-only. **Watchlist, preview, and assignments are available to all server
members.** Other Canvas commands require an ID in `APPROVED_USER_IDS`.

| Command | Purpose |
| --- | --- |
| `!canvas watch <course_id> [#channel]` | Watch a course and send assignment reminders to a channel. |
| `!canvas unwatch <course_id> [#channel]` | Stop watching a course in a channel. |
| `!canvas watchlist` | List courses watched in the server. |
| `!canvas sync` | Sync watched courses now. |
| `!canvas preview [course ID or name] [position]` | Preview one of the 10 most recent course announcements. |
| `!canvas assignments [course ID or name]` | List all assignments and due dates, oldest first. |

For watch and unwatch, omitting `#channel` uses the current channel.

For preview, assignments, and its `asm` alias, omitting the course uses the **only
course watched in the current channel**. This works for both text and slash commands:

```text
!canvas preview
!canvas assignments
!canvas asm
```

If the channel has no watched courses or multiple watched courses, specify a course
name or ID instead. Explicit IDs still work without a channel subscription.

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
It can also be omitted while setting `position` (for example, `/canvas preview position:2`).
For text commands, a lone number remains a course ID, not an announcement position.

### Announcement layout

Canvas announcements use Components V2 cards to keep text and images together
without narrowing the text around small images. Long announcements and galleries
exceeding 10 images continue in additional cards.

### Assignment lists

```text
!canvas assignments 12345
!canvas assignments operating systems
!canvas assignments "Biology 101"
```

The command fetches all assignments from Canvas, including past assignments, rather
than only the upcoming assignments cached for reminders. It sorts by due date from
oldest to newest; assignments without a valid due date appear last. Dates display
in your Discord client's local time alongside relative time (such as "in 3 days" or
"2 days ago"), and assignment names link to Canvas when a URL
is available. Long lists continue across multiple messages.

Course names use the same current-channel matching as preview. Unlike preview,
there is no position argument, so names ending in numbers do not require quotes.
The slash equivalent is `/canvas assignments course_id:<ID or name>`.
`asm` is an alias for `assignments` in both text and slash commands:
`!canvas asm operating systems` or `/canvas asm course_id:operating systems`.

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
