import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  fetchHinataBlogs,
  fetchNogiBlog,
  fetchNogiBlogsByDate,
  fetchSakuraBlogs,
  type Blog,
  type SakuraBlog
} from "@sakamichi-blog-archive/utils/blogs"
import {
  hinataMembers,
  nogiMembers,
  sakuraMembers,
  type Member
} from "@sakamichi-blog-archive/utils/members"

import type { DayEntry, YearData } from "./types.js"

// keyaki-blogs/ is historical data only — Keyakizaka46 became Sakurazaka46 in 2020
// and no longer has an active blog.
type Group = "hinata" | "nogi" | "sakura"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../")

const dirs: Record<Group, string> = {
  hinata: "hinata-blogs",
  nogi: "nogi-blogs",
  sakura: "sakura-blogs"
}

function buildNameMap(members: Member[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of members) {
    map.set(m.name, m.uid)
    map.set(m.nameSpaced, m.uid)
  }
  return map
}

const nameToUid: Record<Group, Map<string, string>> = {
  hinata: buildNameMap(hinataMembers),
  nogi: buildNameMap(nogiMembers),
  sakura: buildNameMap(sakuraMembers)
}

export function yesterdayJST(): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  jstNow.setUTCDate(jstNow.getUTCDate() - 1)
  return jstNow.toISOString().slice(0, 10)
}

function daysUpTo(targetDate: string): DayEntry[] {
  const days: DayEntry[] = []
  const year = parseInt(targetDate.slice(0, 4))
  const d = new Date(Date.UTC(year, 0, 1))
  while (d.toISOString().slice(0, 10) <= targetDate) {
    days.push({ date: d.toISOString().slice(0, 10), count: 0, members: [] })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ blogs: T[] }>
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const { blogs } = await fetchPage(page)
    if (blogs.length === 0) break
    all.push(...blogs)
  }
  return all
}

// The nogi date-filtered list page doesn't expose member names, unlike the JSON
// list API — so each post needs a follow-up fetch to resolve its member.
async function fetchBlogs(group: Group, targetDate: string): Promise<(Blog | SakuraBlog)[]> {
  const [year, month, day] = targetDate.split("-").map(Number)
  if (group === "hinata") return fetchAllPages(page => fetchHinataBlogs({ year, month, day, page }))
  if (group === "sakura") return fetchAllPages(page => fetchSakuraBlogs({ year, month, day, page }))

  const summaries = await fetchAllPages(page => fetchNogiBlogsByDate({ year, month, day, page }))
  return Promise.all(summaries.map(async s => (await fetchNogiBlog(s.uid)).blog))
}

export async function updateGroup(group: Group, targetDate = yesterdayJST()): Promise<void> {
  const blogs = await fetchBlogs(group, targetDate)

  const postCount = blogs.length
  const members = blogs
    .flatMap(b => {
      const uid = nameToUid[group].get(b.memberName)
      if (!uid) console.warn(`unknown member name "${b.memberName}" in ${group}`)
      return uid ? [uid] : []
    })
    .sort()

  const year = parseInt(targetDate.slice(0, 4))
  const dir = join(ROOT, dirs[group])
  const filePath = join(dir, `${year}.json`)

  let raw: string | null = null
  try {
    raw = await readFile(filePath, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  const data: YearData = raw !== null ? JSON.parse(raw) : { count: 0, days: daysUpTo(targetDate) }

  const dayIndex = data.days.findIndex(d => d.date === targetDate)
  if (dayIndex !== -1) {
    data.days[dayIndex] = { date: targetDate, count: postCount, members }
  } else {
    data.days.push({ date: targetDate, count: postCount, members })
  }
  data.count = data.days.reduce((sum, d) => sum + d.count, 0)

  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
  console.log(`updated ${dirs[group]}/${year}.json (${targetDate}: ${postCount} posts)`)
}
