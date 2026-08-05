# @sakamichi-blog-archive/updater

Fetches blog posts and official schedule events and updates the group JSON files in this repository.

## Usage

```sh
pnpm run update:blogs               # updates yesterday's blog posts (JST)
pnpm run update:blogs 2026-07-06    # updates a specific date's blog posts

pnpm run update:schedule            # updates the current and next JST calendar month's schedule events
pnpm run update:schedule 2026-07-06 # same, using this date to determine current/next month
```
