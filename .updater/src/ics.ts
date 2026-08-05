import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildGroupIcs } from "./lib/ics.js"
import type { Group } from "./lib/types.js"

// Written under .updater/dist so a plain `aws s3 sync` of this directory in CI reproduces the
// {group}/calendar.ics key layout expected in the R2 bucket.
const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/calendars")

const groups: Group[] = ["hinata", "nogi", "sakura"]

await Promise.all(
  groups.map(async group => {
    const ics = await buildGroupIcs(group)
    const filePath = join(OUTPUT_DIR, group, "calendar.ics")
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, ics)
    console.log(`wrote ${filePath}`)
  })
)
