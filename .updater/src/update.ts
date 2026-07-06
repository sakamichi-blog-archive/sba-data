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

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function allDaysOfYear(year: number): string[] {
  const days: string[] = []
  const d = new Date(Date.UTC(year, 0, 1))
  while (d.getUTCFullYear() === year) {
    days.push(d.toISOString().slice(0, 10))
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
  const blogs = await fetchBlogs(group)

  const byYear = new Map<number, Map<string, Set<string>>>()
  for (const blog of blogs) {
    const date = blogDate(blog)
    const year = date.getUTCFullYear()
    const dateStr = toDateString(date)
    const uid = String(blog.uid)
    if (!byYear.has(year)) byYear.set(year, new Map())
    const byDate = byYear.get(year)!
    if (!byDate.has(dateStr)) byDate.set(dateStr, new Set())
    byDate.get(dateStr)!.add(uid)
  }

  const dir = join(ROOT, dirs[group])

  for (const [year, byDate] of byYear) {
    const filePath = join(dir, `${year}.json`)

    const dayMap = new Map<string, DayEntry>()
    try {
      const existing: YearData = JSON.parse(await readFile(filePath, 'utf8'))
      for (const day of existing.days) dayMap.set(day.date, day)
    } catch {}

    for (const [date, uids] of byDate) {
      const members = [...uids].sort()
      dayMap.set(date, { date, count: members.length, members })
    }

    const days: DayEntry[] = allDaysOfYear(year).map(
      date => dayMap.get(date) ?? { date, count: 0, members: [] }
    )
    const count = days.reduce((sum, d) => sum + d.count, 0)

    await writeFile(filePath, JSON.stringify({ count, days }, null, 2) + '\n')
    console.log(`updated ${dirs[group]}/${year}.json`)
  }
}
