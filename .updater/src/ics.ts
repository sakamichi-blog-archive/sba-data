import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildGroupBirthdaysIcs, buildGroupEventsIcs } from "./lib/ics.js"
import type { Group } from "./lib/types.js"

// Written under .updater/dist so a plain `aws s3 sync` of this directory in CI reproduces the
// {group}/events.ics and {group}/birthdays.ics key layout expected in the R2 bucket.
const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/calendars")

const groups: Group[] = ["hinata", "nogi", "sakura"]

await Promise.all(
  groups.map(async group => {
    const dir = join(OUTPUT_DIR, group)
    await mkdir(dir, { recursive: true })

    const [eventsIcs, birthdaysIcs] = await Promise.all([
      buildGroupEventsIcs(group),
      buildGroupBirthdaysIcs(group)
    ])
    await Promise.all([
      writeFile(join(dir, "events.ics"), eventsIcs),
      writeFile(join(dir, "birthdays.ics"), birthdaysIcs)
    ])
    console.log(`wrote ${dir}/events.ics and ${dir}/birthdays.ics`)
  })
)
