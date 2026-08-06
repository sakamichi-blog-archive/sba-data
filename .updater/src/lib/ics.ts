import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  hinataMembers,
  nogiMembers,
  sakuraMembers,
  type Member
} from "@sakamichi-blog-archive/utils/members"
import {
  getHinataScheduleEventUrl,
  getNogiScheduleEventUrl,
  getSakuraScheduleUrl
} from "@sakamichi-blog-archive/utils/schedule"
import { createEvents, type DateArray, type EventAttributes } from "ics"

import { isInMonth, monthsToFetch, todayJST } from "./schedule.js"
import type { Group, ScheduleEventEntry, ScheduleYearData } from "./types.js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../")

const BIRTHDAY_CATEGORY = "誕生日"

const dirs: Record<Group, string> = {
  hinata: "data/hinata/schedule",
  nogi: "data/nogi/schedule",
  sakura: "data/sakura/schedule"
}

const calNames: Record<Group, string> = {
  hinata: "Hinatazaka46 Schedule",
  nogi: "Nogizaka46 Schedule",
  sakura: "Sakurazaka46 Schedule"
}

function buildMemberMap(members: Member[]): Map<string, Member> {
  return new Map(members.map(m => [m.uid, m]))
}

const membersByUid: Record<Group, Map<string, Member>> = {
  hinata: buildMemberMap(hinataMembers),
  nogi: buildMemberMap(nogiMembers),
  sakura: buildMemberMap(sakuraMembers)
}

// Raw titles are inconsistent across groups (nogi's is just the member's name; hinata/sakura
// append "の誕生日") and none of them show age. Rebuilding from the member roster gives every
// group the same "🎂 {name}の{age}歳の誕生日" format. Falls back to the raw title if the member
// or their birthdate isn't in the roster (e.g. a name-matching miss upstream).
function birthdayTitle(group: Group, event: ScheduleEventEntry): string {
  const uid = event.member_uids[0]
  const member = uid !== undefined ? membersByUid[group].get(uid) : undefined
  if (member?.birthdate === undefined) return event.title

  const eventYear = Number(event.date.split("-")[0])
  const birthYear = Number(member.birthdate.split("-")[0])
  return `🎂 ${member.nameSpaced}の${eventYear - birthYear}歳の誕生日`
}

// The nogi schedule API's own event id resolves to a media/announcement page, but for a
// "誕生日" (birthday) entry the official site instead links to the member's profile page —
// there's no id-based URL for that. Building it directly from member_uids is the only option.
function nogiArtistUrl(memberUid: string): string {
  return `https://www.nogizaka46.com/s/n46/artist/${memberUid}`
}

function eventUrl(group: Group, event: ScheduleEventEntry): string | undefined {
  if (group === "nogi" && event.category === "誕生日") {
    const memberUid = event.member_uids[0]
    return memberUid !== undefined ? nogiArtistUrl(memberUid) : undefined
  }
  if (group === "hinata")
    return event.id !== undefined ? getHinataScheduleEventUrl(event.id) : undefined
  if (group === "nogi")
    return event.id !== undefined ? getNogiScheduleEventUrl(event.id) : undefined

  const [year, month, day] = event.date.split("-").map(Number)
  return getSakuraScheduleUrl({ year: year!, month: month!, day })
}

// ics UIDs must stay stable across runs so calendar clients update existing events instead of
// duplicating them. id alone isn't enough — hinata/sakura recurring events share one id across
// many dates — so id+date disambiguates occurrences. Events with no id (rare) fall back to a
// short hash of date+title.
function eventUid(group: Group, event: ScheduleEventEntry): string {
  if (event.id !== undefined) return `${group}-${event.id}-${event.date}`
  const hash = createHash("sha1").update(`${event.date}:${event.title}`).digest("hex").slice(0, 12)
  return `${group}-${hash}`
}

function toUtcDateArray(date: string, time: string | undefined): DateArray {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number]
  if (time === undefined) return [year, month, day]

  const [hour, minute] = time.split(":").map(Number) as [number, number]
  // Wall-clock time is JST (UTC+9); shifting back 9h before reading UTC fields converts it.
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000)
  return [
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes()
  ]
}

// All-day (no time_start) events use a date-only start, and RFC 5545 requires their end to be
// the exclusive start of the following day.
function nextDateArray(date: string): DateArray {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number]
  const utc = new Date(Date.UTC(year, month - 1, day + 1))
  return [utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate()]
}

function toIcsEvent(group: Group, event: ScheduleEventEntry): EventAttributes {
  const start = toUtcDateArray(event.date, event.time_start)
  const endOrDuration =
    event.time_start === undefined
      ? { end: nextDateArray(event.date) }
      : event.time_end !== undefined
        ? { end: toUtcDateArray(event.date, event.time_end) }
        : // No end time given for a timed event — an hour is a reasonable default duration.
          { duration: { hours: 1 } }

  return {
    uid: eventUid(group, event),
    title: event.category === BIRTHDAY_CATEGORY ? birthdayTitle(group, event) : event.title,
    start,
    startInputType: "utc",
    startOutputType: "utc",
    ...("end" in endOrDuration
      ? { endInputType: "utc" as const, endOutputType: "utc" as const }
      : {}),
    ...endOrDuration,
    url: eventUrl(group, event),
    categories: event.category !== undefined ? [event.category] : undefined
  }
}

async function readYear(group: Group, year: number): Promise<ScheduleYearData> {
  const filePath = join(ROOT, dirs[group], `${year}.json`)
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as ScheduleYearData
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { count: 0, events: [] }
    throw err
  }
}

async function readYears(group: Group, years: number[]): Promise<ScheduleEventEntry[]> {
  const yearData = await Promise.all(years.map(year => readYear(group, year)))
  return yearData.flatMap(d => d.events)
}

export async function buildGroupEventsIcs(
  group: Group,
  referenceDate = todayJST()
): Promise<string> {
  const filters = monthsToFetch(referenceDate)
  const years = [...new Set(filters.map(f => f.year))]
  const allEvents = await readYears(group, years)

  const events = allEvents
    .filter(
      e => e.category !== BIRTHDAY_CATEGORY && filters.some(f => isInMonth(e.date, f.year, f.month))
    )
    .map(e => toIcsEvent(group, e))

  const { error, value } = createEvents(events, {
    calName: calNames[group],
    productId: "-//sba-data//schedule//EN"
  })
  if (error) throw error
  return value!
}

// Unlike buildGroupEventsIcs, this isn't windowed to the current + next JST month — birthdays
// recur once a year, so a short window would make the calendar mostly empty. Two full calendar
// years (current + next) gives a stable one-year-ahead view, matching how contacts apps surface
// birthdays.
export async function buildGroupBirthdaysIcs(
  group: Group,
  referenceDate = todayJST()
): Promise<string> {
  const currentYear = Number(referenceDate.split("-")[0])
  const allEvents = await readYears(group, [currentYear, currentYear + 1])

  const events = allEvents
    .filter(e => e.category === BIRTHDAY_CATEGORY)
    .map(e => toIcsEvent(group, e))

  const { error, value } = createEvents(events, {
    calName: `${calNames[group]} Birthdays`,
    productId: "-//sba-data//birthdays//EN"
  })
  if (error) throw error
  return value!
}
