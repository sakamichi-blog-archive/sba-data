import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  fetchHinataScheduleEvent,
  fetchHinataScheduleEvents,
  fetchNogiScheduleEvents,
  fetchSakuraScheduleEvents,
  type ScheduleFilter
} from "@sakamichi-blog-archive/utils/schedule"

import { nameToUid } from "./name-to-uid.js"
import type { Group, ScheduleEventEntry, ScheduleYearData } from "./types.js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../")

const dirs: Record<Group, string> = {
  hinata: "data/hinata/schedule",
  nogi: "data/nogi/schedule",
  sakura: "data/sakura/schedule"
}

export function todayJST(): string {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jstNow.toISOString().slice(0, 10)
}

// The Date reflects JST midnight, so shifting it forward 9h before slicing recovers
// the intended JST calendar date instead of the UTC one.
function formatJstDate(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function monthsToFetch(referenceDate: string): ScheduleFilter[] {
  const [year, month] = referenceDate.split("-").map(Number)
  // Passing the 1-based current month as Date.UTC's 0-based month argument lands on
  // day 1 of next month, letting the year rollover (e.g. Dec -> Jan) fall out for free.
  const next = new Date(Date.UTC(year, month, 1))
  return [
    { year, month },
    { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 }
  ]
}

interface RawScheduleEvent {
  category?: string
  date: Date
  id?: string
  members?: string[]
  timeStart?: string
  timeEnd?: string
  title: string
  url?: string
}

async function fetchRawEvents(group: Group, filter: ScheduleFilter): Promise<RawScheduleEvent[]> {
  if (group === "hinata") return (await fetchHinataScheduleEvents(filter)).events
  if (group === "nogi") return (await fetchNogiScheduleEvents(filter)).events
  return (await fetchSakuraScheduleEvents(filter)).events
}

// Unlike nogi/sakura, hinata's list events carry no members — fetch each unique event
// id's detail once (recurring events share an id) rather than once per occurrence.
async function fetchHinataMembersById(events: RawScheduleEvent[]): Promise<Map<string, string[]>> {
  const ids = [...new Set(events.map(e => e.id).filter((id): id is string => id !== undefined))]
  const details = await Promise.all(ids.map(id => fetchHinataScheduleEvent(id)))
  return new Map(ids.map((id, index) => [id, details[index]!.event.members]))
}

function isInMonth(date: string, year: number, month: number): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, "0")}`)
}

function compareEvents(a: ScheduleEventEntry, b: ScheduleEventEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.time_start !== b.time_start) {
    if (a.time_start === undefined) return 1
    if (b.time_start === undefined) return -1
    return a.time_start < b.time_start ? -1 : 1
  }
  return a.title.localeCompare(b.title)
}

export async function updateGroupSchedule(group: Group, referenceDate = todayJST()): Promise<void> {
  for (const filter of monthsToFetch(referenceDate)) {
    // Sequential by necessity: consecutive months can land in the same year file,
    // so the second iteration's read-modify-write must see the first's result.
    // oxlint-disable-next-line no-await-in-loop
    const rawEvents = await fetchRawEvents(group, filter)
    let hinataMembersById: Map<string, string[]> | undefined
    if (group === "hinata") {
      // oxlint-disable-next-line no-await-in-loop
      hinataMembersById = await fetchHinataMembersById(rawEvents)
    }

    const newEvents: ScheduleEventEntry[] = rawEvents.map(e => {
      const names = hinataMembersById
        ? e.id
          ? (hinataMembersById.get(e.id) ?? [])
          : []
        : (e.members ?? [])
      const memberUids = names.flatMap(name => {
        const uid = nameToUid[group].get(name)
        if (!uid) console.warn(`unknown member name "${name}" in ${group} schedule`)
        return uid ? [uid] : []
      })

      return {
        date: formatJstDate(e.date),
        category: e.category,
        title: e.title,
        member_uids: memberUids,
        time_start: e.timeStart,
        time_end: e.timeEnd,
        id: e.id,
        url: e.url
      }
    })

    const dir = join(ROOT, dirs[group])
    const filePath = join(dir, `${filter.year}.json`)

    let raw: string | null = null
    try {
      // oxlint-disable-next-line no-await-in-loop
      raw = await readFile(filePath, "utf8")
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }

    const data: ScheduleYearData = raw !== null ? JSON.parse(raw) : { count: 0, events: [] }

    const otherEvents = data.events.filter(e => !isInMonth(e.date, filter.year, filter.month))
    data.events = [...otherEvents, ...newEvents].toSorted(compareEvents)
    data.count = data.events.length

    // oxlint-disable-next-line no-await-in-loop
    await writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
    const monthLabel = `${filter.year}-${String(filter.month).padStart(2, "0")}`
    console.log(
      `updated ${dirs[group]}/${filter.year}.json (${monthLabel}: ${newEvents.length} events)`
    )
  }
}
