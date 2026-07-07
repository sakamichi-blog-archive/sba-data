import {
  fetchHinataBlogs,
  fetchNogiBlogs,
  fetchSakuraBlogs,
  type Blog,
  type SakuraBlog,
} from '@sakamichi-blog-archive/utils/blogs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DayEntry, YearData } from './types.js'

type Group = 'hinata' | 'nogi' | 'sakura'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../')

const dirs: Record<Group, string> = {
  hinata: 'hinata-blogs',
  nogi: 'nogi-blogs',
  sakura: 'sakura-blogs',
}

function blogDate(blog: Blog | SakuraBlog): Date {
  return 'datetime' in blog ? blog.datetime : blog.date
}

// Blogs are published in JST (UTC+9). We use JST dates throughout.
function toJSTDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function yesterdayJST(): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  jstNow.setUTCDate(jstNow.getUTCDate() - 1)
  return jstNow.toISOString().slice(0, 10)
}

function allDaysOfYear(year: number): DayEntry[] {
  const days: DayEntry[] = []
  const d = new Date(Date.UTC(year, 0, 1))
  while (d.getUTCFullYear() === year) {
    days.push({ date: d.toISOString().slice(0, 10), count: 0, members: [] })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

async function fetchBlogs(group: Group): Promise<(Blog | SakuraBlog)[]> {
  if (group === 'hinata') return (await fetchHinataBlogs()).blogs
  if (group === 'nogi') return (await fetchNogiBlogs()).blogs
  return (await fetchSakuraBlogs()).blogs
}

export async function updateGroup(group: Group): Promise<void> {
  const targetDate = yesterdayJST()
  const blogs = await fetchBlogs(group)

  const filtered = blogs.filter(b => toJSTDateString(blogDate(b)) === targetDate)
  const postCount = filtered.length
  const members = [...new Set(filtered.map(b => String(b.uid)))].sort()

  const year = parseInt(targetDate.slice(0, 4))
  const dir = join(ROOT, dirs[group])
  const filePath = join(dir, `${year}.json`)

  let raw: string | null = null
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  const data: YearData = raw !== null
    ? JSON.parse(raw)
    : { count: 0, days: allDaysOfYear(year) }

  const dayIndex = data.days.findIndex(d => d.date === targetDate)
  if (dayIndex !== -1) {
    data.days[dayIndex] = { date: targetDate, count: postCount, members }
  }
  data.count = data.days.reduce((sum, d) => sum + d.count, 0)

  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`updated ${dirs[group]}/${year}.json (${targetDate}: ${members.length} posts)`)
}
