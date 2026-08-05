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

Each group's upcoming schedule (current + next month) is published as a subscribable `.ics` calendar, regenerated every 6 hours alongside the schedule data:

- Hinatazaka46: <https://calendars.sakamichi.co/hinata/calendar.ics>
- Nogizaka46: <https://calendars.sakamichi.co/nogi/calendar.ics>
- Sakurazaka46: <https://calendars.sakamichi.co/sakura/calendar.ics>

## Data pipeline

GitHub Actions workflows fetch data from each group's official site and commit updated files to the group directories above: blog post data daily, schedule event data every 6 hours.

## Web app

The Astro site lives in `.web/` and is deployed to Cloudflare Workers. It reads the data files at build time to render the contribution heatmaps.

```sh
cd .web
pnpm install
pnpm dev
```
