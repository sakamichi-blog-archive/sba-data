import { archiveUrls } from "./lib/archive.js"
import { parseArchiveArgs } from "./lib/args.js"
import { fetchBlogs } from "./lib/blogs.js"

const accessKey = process.env.INTERNET_ARCHIVE_ACCESS_KEY
const secretKey = process.env.INTERNET_ARCHIVE_SECRET_KEY

if (!accessKey || !secretKey) {
  console.error("INTERNET_ARCHIVE_ACCESS_KEY/INTERNET_ARCHIVE_SECRET_KEY not set")
  process.exit(1)
}

let date: string | undefined
let groups

try {
  ;({ date, groups } = parseArchiveArgs(process.argv.slice(2)))
} catch (err) {
  console.error((err as Error).message)
  process.exit(1)
}

const blogLists = await Promise.all(groups.map(group => fetchBlogs(group, date)))

await archiveUrls(
  blogLists.flat().map(b => b.url),
  accessKey,
  secretKey
)
