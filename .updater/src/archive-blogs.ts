import { archiveUrls } from "./lib/archive.js"
import { fetchBlogs } from "./lib/blogs.js"
import type { Group } from "./lib/types.js"

const date = process.argv[2]

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

const groups: Group[] = ["hinata", "nogi", "sakura"]
const blogLists = await Promise.all(groups.map(group => fetchBlogs(group, date)))

await archiveUrls(blogLists.flat().map(b => b.url))
