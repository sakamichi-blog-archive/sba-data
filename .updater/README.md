# @sakamichi-blog-archive/updater

Fetches blog posts and official schedule events and updates the group JSON files in this repository.

## Usage

```sh
pnpm run update:blogs               # updates yesterday's blog posts (JST)
pnpm run update:blogs 2026-07-06    # updates a specific date's blog posts

pnpm run archive:blogs               # submits yesterday's blog posts (JST) to the Wayback Machine
pnpm run archive:blogs 2026-07-06    # same, for a specific date
pnpm run archive:blogs --group=nogi  # same, for one group only (default: all three)

pnpm run update:schedule            # updates the current and next JST calendar month's schedule events
pnpm run update:schedule 2026-07-06 # same, using this date to determine current/next month
```

`archive:blogs` re-fetches the given date's posts independently (it doesn't read the committed
JSON, which doesn't store post URLs) and submits each to the Internet Archive's
[Save Page Now (SPN2) API](https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA).
Requires `INTERNET_ARCHIVE_ACCESS_KEY`/`INTERNET_ARCHIVE_SECRET_KEY` env vars (S3-style keys from
[archive.org/account/s3.php](https://archive.org/account/s3.php)); without them it exits with a
non-zero status before fetching anything.

SPN2 caps concurrent capture sessions per account, so posts are submitted strictly one at a
time: each job is polled to completion (giving up after 3 minutes, though the capture keeps
running server-side) before the next is submitted, and a submission that still hits the session
limit is retried after a wait. Runtime therefore scales with post count, which is why the
scheduled workflow archives only yesterday while `update:blogs` covers a 3-day window, and runs
one group per job via `--group=`. Those jobs must not overlap — the SPN session limit is per
account, so the workflow serialises them with `max-parallel: 1`.
