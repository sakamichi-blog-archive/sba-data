# CLAUDE.md

## Project

Blog post data repository for the Sakamichi Series, with a companion web app. Successor to [sba-contributions](https://github.com/sakamichi-blog-archive/sba-contributions).

The primary purpose of this repo is data. The web app (`.web/`) is a side-project built on top of it.

## Repository structure

```
hinata-blogs/   Hinatazaka46 blog data
keyaki-blogs/   Keyakizaka46 blog data (historical only — group became Sakurazaka46 in 2020)
nogi-blogs/     Nogizaka46 blog data
sakura-blogs/   Sakurazaka46 blog data
.updater/       Node.js project for fetching and updating blog data
.web/           Astro web app + Cloudflare Workers config
```

## Stack

- **Astro** — static site with islands where interactivity is needed
- **Cloudflare Workers** — hosting
- **GitHub Actions** — daily scheduled workflow fetches and commits updated blog data
- **pnpm** — package manager

## Data format

Each group directory (`nogi-blogs/`, `hinata-blogs/`, `keyaki-blogs/`, `sakura-blogs/`) contains one JSON file per year:

```
{group}-blogs/{year}.json
```

Schema:

```jsonc
{
  "count": 891,          // total posts for the year
  "days": [
    {
      "date": "2025-01-01",          // YYYY-MM-DD
      "count": 5,                    // posts on this day
      "members": ["55389", "55389", "55400"]  // member UIDs, one per post (duplicates preserved)
    }
  ]
}
```

`days` contains an entry for every calendar day of the year. Days with no posts have `count: 0` and `members: []`.

Member data (names, generations, etc.) is not stored here — only their UIDs.

## Architecture

Data is fetched and committed to the repo by a scheduled GitHub Actions workflow. The Astro build reads static data files from the group directories — no runtime data fetching.

## What to avoid

- Do not use Next.js or any Node-based SSR framework.
- Do not use Firebase.
- Do not trigger data updates from Google Cloud or external orchestration — GitHub Actions only.
- Do not use npm or yarn; use pnpm.
