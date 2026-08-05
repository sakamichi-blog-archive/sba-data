import { buildGroupIcs } from "./lib/ics.js"
import { uploadGroupIcs } from "./lib/r2.js"
import type { Group } from "./lib/types.js"

const groups: Group[] = ["hinata", "nogi", "sakura"]

await Promise.all(
  groups.map(async group => {
    const ics = await buildGroupIcs(group)
    await uploadGroupIcs(group, ics)
    console.log(`uploaded ${group}/calendar.ics`)
  })
)
