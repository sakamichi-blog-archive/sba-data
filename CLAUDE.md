# CLAUDE.md

## Project

Blog post data repository for the Sakamichi Series, with a companion web app. Successor to [sba-contributions](https://github.com/sakamichi-blog-archive/sba-contributions).

The primary purpose of this repo is data. The web app (`.web/`) is a side-project built on top of it.

## Repository structure

```
data/hinata/blogs/      Hinatazaka46 blog data
data/hinata/schedule/   Hinatazaka46 schedule event data
data/keyaki/blogs/      Keyakizaka46 blog data (historical only — group became Sakurazaka46 in 2020)
data/nogi/blogs/        Nogizaka46 blog data
data/nogi/schedule/     Nogizaka46 schedule event data
data/sakura/blogs/      Sakurazaka46 blog data
data/sakura/schedule/   Sakurazaka46 schedule event data
.updater/               Node.js project for fetching and updating blog and schedule data
.web/                   Astro web app + Cloudflare Workers config
```

Keyaki has no `schedule/` directory — Keyakizaka46 no longer has an active schedule.

## Stack

- **Astro** — static site with islands where interactivity is needed
- **Cloudflare Workers** — hosting
- **GitHub Actions** — scheduled workflows fetch and commit updated data: blogs daily, schedule events every 6 hours
- **pnpm** — package manager

## Data format

Each group directory (`data/nogi/blogs/`, `data/hinata/blogs/`, `data/keyaki/blogs/`, `data/sakura/blogs/`) contains one JSON file per year:

```
data/{group}/blogs/{year}.json
```

Schema:

```jsonc
{
  "count": 891, // total posts for the year
  "days": [
    {
      "date": "2025-01-01", // YYYY-MM-DD
      "count": 5, // posts on this day
      "members": ["55389", "55389", "55400"] // member UIDs, one per post (duplicates preserved)
    }
  ]
}
```

`days` contains an entry for every calendar day of the year. Days with no posts have `count: 0` and `members: []`.

Member data (names, generations, etc.) is not stored here — only their UIDs.

Each group's `schedule/` directory (`data/nogi/schedule/`, `data/hinata/schedule/`, `data/sakura/schedule/` — no keyaki) similarly contains one JSON file per year:

```
data/{group}/schedule/{year}.json
```

Schema:

```jsonc
{
  "count": 42, // total events in the year
  "events": [
    {
      "date": "2026-08-05", // YYYY-MM-DD
      "category": "ライブ/イベント", // optional, as shown on the official site
      "title": "...",
      "member_uids": ["25", "31"], // member UIDs; empty if none listed
      "time_start": "18:00", // optional, HH:mm JST
      "time_end": "20:00", // optional, HH:mm JST
      "id": "12345" // optional site event id; recurring events share an id
    }
  ]
}
```

Unlike `blogs/`, `events` only lists days that actually have events (no zero-event placeholder entries), and isn't split into one entry per calendar day. Each update run refetches the current and next JST calendar month and replaces just those months' events in the target year file(s) — event content isn't diffed or hashed; git history is the record of what changed.

No `url` is stored — it's cheaply derivable from `id` (and `date` for sakura) via `@sakamichi-blog-archive/utils`'s `get*ScheduleEventUrl`/`getSakuraScheduleUrl` helpers whenever a consumer needs a link.

## Architecture

Data is fetched and committed to the repo by scheduled GitHub Actions workflows (one for blogs, one for schedule). The Astro build reads static data files from the group directories — no runtime data fetching.

## What to avoid

- Do not use Next.js or any Node-based SSR framework.
- Do not use Firebase.
- Do not trigger data updates from Google Cloud or external orchestration — GitHub Actions only.
- Do not use npm or yarn; use pnpm.
