# @sakamichi-blog-archive/updater

Fetches blog posts and official schedule events and updates the group JSON files in this repository.

## Usage

```sh
pnpm run update:blogs               # updates yesterday's blog posts (JST)
pnpm run update:blogs 2026-07-06    # updates a specific date's blog posts

pnpm run archive:blogs               # submits yesterday's blog posts (JST) to the Wayback Machine
pnpm run archive:blogs 2026-07-06    # same, for a specific date

pnpm run update:schedule            # updates the current and next JST calendar month's schedule events
pnpm run update:schedule 2026-07-06 # same, using this date to determine current/next month
```

`archive:blogs` re-fetches the given date's posts independently (it doesn't read the committed
JSON, which doesn't store post URLs) and submits each to the Internet Archive's Save Page Now API.
Requires `INTERNET_ARCHIVE_ACCESS_KEY`/`INTERNET_ARCHIVE_SECRET` env vars (S3-style keys from
[archive.org/account/s3.php](https://archive.org/account/s3.php)); without them it logs a warning
and skips archiving.
