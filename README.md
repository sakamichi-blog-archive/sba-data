# sba-data

This repo stores the following data in [`data/`](./data/):

- Blogs data: Each item representing a date and members that posted on that date
- Schedule data: Items for each event

In addition, the following are published as side projects:

- Blog contributions web app, that visualizes blog post frequency as GitHub style heatmaps
- Subscribable calendars, generated from official schedule

## Repository structure

```text
data/<group>/blogs/     Blog data
data/<group>/schedule/  Schedule data
```

## Blog contributions web app

<https://contributions.sakamichi.co>

## Schedule calendars

Each group publishes 2 subscribable `.ics` calendars:

- `birthdays.ics`: Member birthdays (current + next year)
- `events.ics`: Upcoming schedule (current + next month), excluding member birthdays

### How to subscribe

- Apple Calendar: File → New Calendar Subscription
  - [Use iCloud calendar subscriptions - Apple Support](https://support.apple.com/en-us/102301)
- Google Calendar: Other calendars → From URL
  - [Subscribe to someone else's calendar - Computer - Google Calendar Help](https://support.google.com/calendar/answer/37100?hl=en)
- Outlook: Add calendar → Subscribe from web
  - [Import or subscribe to a calendar in Outlook.com or Outlook on the web | Microsoft Support](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)

### URLs

- Nogizaka46
  - Birthdays: <https://calendars.sakamichi.co/nogi/birthdays.ics>
  - Events: <https://calendars.sakamichi.co/nogi/events.ics>

- Hinatazaka46
  - Birthdays: <https://calendars.sakamichi.co/hinata/birthdays.ics>
  - Events: <https://calendars.sakamichi.co/hinata/events.ics>

- Sakurazaka46
  - Birthdays: <https://calendars.sakamichi.co/sakura/birthdays.ics>
  - Events: <https://calendars.sakamichi.co/sakura/events.ics>

## Data update frequency

Both are updated through GitHub Actions schedule events.

- Blogs: Updated daily at 00:30 JST
- Schedule: Updated every 6 hours

*Don't expect GitHub Actions to run on the dot; they eventually do run before the next interval.
