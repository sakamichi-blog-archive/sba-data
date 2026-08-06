# sba-data

Blog post data for the Sakamichi Series (Nogizaka46, Keyakizaka46, Sakurazaka46, Hinatazaka46), with a companion web app that visualizes posting activity as GitHub-style contribution heatmaps.

Successor to [sba-contributions](https://github.com/sakamichi-blog-archive/sba-contributions).

## Repository structure

```
data/hinata/blogs/      Hinatazaka46 blog data
data/hinata/schedule/   Hinatazaka46 schedule event data
data/keyaki/blogs/      Keyakizaka46 blog data
data/nogi/blogs/        Nogizaka46 blog data
data/nogi/schedule/     Nogizaka46 schedule event data
data/sakura/blogs/      Sakurazaka46 blog data
data/sakura/schedule/   Sakurazaka46 schedule event data
.updater/               Node.js project for fetching and updating blog and schedule data
.web/                   Astro web app + Cloudflare Workers config
```

## Schedule calendars

Each group publishes two subscribable `.ics` calendars, regenerated every 6 hours alongside the schedule data:

- `birthdays.ics`: member birthdays for the current and next year (e.g. "🎂 伊藤理々杏の24歳の誕生日")
- `events.ics`: upcoming schedule (current + next month), excluding member birthdays

### How to subscribe

- Apple Calendar: File → New Calendar Subscription
  - [Use iCloud calendar subscriptions - Apple Support](https://support.apple.com/en-us/102301)
- Google Calendar: Other calendars → From URL
  - [Subscribe to someone else's calendar - Computer - Google Calendar Help](https://support.google.com/calendar/answer/37100?hl=en)
- Outlook: Add calendar → Subscribe from web
  - [Import or subscribe to a calendar in Outlook.com or Outlook on the web | Microsoft Support](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)

### Nogizaka46 URLs

Birthdays:

```text
https://calendars.sakamichi.co/nogi/birthdays.ics
```

Events:

```text
https://calendars.sakamichi.co/nogi/events.ics
```

### Hinatazaka46 URLs

Birthdays:

```text
https://calendars.sakamichi.co/hinata/birthdays.ics
```

Events:

```text
https://calendars.sakamichi.co/hinata/events.ics
```

### Sakurazaka46 URLs

Birthdays:

```text
https://calendars.sakamichi.co/sakura/birthdays.ics
```

Events:

```text
https://calendars.sakamichi.co/sakura/events.ics
```

## Data pipeline

GitHub Actions workflows fetch data from each group's official site and commit updated files to the group directories above: blog post data daily, schedule event data every 6 hours.

## Web app

The Astro site lives in `.web/` and is deployed to Cloudflare Workers. It reads the data files at build time to render the contribution heatmaps.

```sh
cd .web
pnpm install
pnpm dev
```
