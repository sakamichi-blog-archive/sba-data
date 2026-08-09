import { archiveUrls } from "./lib/archive.js"
import { fetchBlogs } from "./lib/blogs.js"
import type { Group } from "./lib/types.js"

const ALL_GROUPS: Group[] = ["hinata", "nogi", "sakura"]

const accessKey = process.env.INTERNET_ARCHIVE_ACCESS_KEY
const secretKey = process.env.INTERNET_ARCHIVE_SECRET_KEY

if (!accessKey || !secretKey) {
  console.error("INTERNET_ARCHIVE_ACCESS_KEY/INTERNET_ARCHIVE_SECRET_KEY not set")
  process.exit(1)
}

const args = process.argv.slice(2)

// `--group=` is a flag rather than a second positional so the existing date-only invocation
// keeps working unchanged. Only the `=` form is accepted: a space-separated value would be
// indistinguishable from the date positional when no date is given.
const groupFlag = args.find(arg => arg.startsWith("--group="))
const date = args.find(arg => !arg.startsWith("--"))

if (date !== undefined) {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    console.error(`Invalid date: ${date}. Expected YYYY-MM-DD.`)
    process.exit(1)
  }
}

let groups = ALL_GROUPS

if (groupFlag !== undefined) {
  const value = groupFlag.slice("--group=".length)
  if (!ALL_GROUPS.includes(value as Group)) {
    console.error(`Invalid group: ${value}. Expected one of ${ALL_GROUPS.join(", ")}.`)
    process.exit(1)
  }
  groups = [value as Group]
}

const blogLists = await Promise.all(groups.map(group => fetchBlogs(group, date)))

await archiveUrls(
  blogLists.flat().map(b => b.url),
  accessKey,
  secretKey
)
