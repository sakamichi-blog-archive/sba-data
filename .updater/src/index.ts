import { appendFile } from "node:fs/promises"

import { updateGroup, yesterdayJST } from "./update.js"

const dateArg = process.argv[2]

if (dateArg !== undefined) {
  const parsed = new Date(`${dateArg}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateArg) ||
    isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateArg
  ) {
    console.error(`Invalid date: ${dateArg}. Expected YYYY-MM-DD.`)
    process.exit(1)
  }
}

const date = dateArg ?? yesterdayJST()

await Promise.all([
  updateGroup("hinata", date),
  updateGroup("nogi", date),
  updateGroup("sakura", date)
])

// Lets the GitHub Actions workflow read the updated date back out to put in
// the commit message, without recomputing "yesterday" a second time.
const githubOutput = process.env.GITHUB_OUTPUT
if (githubOutput !== undefined) {
  await appendFile(githubOutput, `date=${date}\n`)
}
