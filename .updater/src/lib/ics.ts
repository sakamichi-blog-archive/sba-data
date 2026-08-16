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

// Every group keys birthdays as "birthday", so the key identifies them across all three — and,
// unlike the displayed label, it doesn't move when the site relabels a category.
const BIRTHDAY_CATEGORY_KEY = "birthday"
const BIRTHDAY_CATEGORY_NAME = "誕生日"

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

const rosters: Record<Group, Member[]> = {
  hinata: hinataMembers,
  nogi: nogiMembers,
  sakura: sakuraMembers
}

// None of the schedule APIs give a birthday entry an id-based detail URL — the official sites
// link these to the member's own profile page instead, so it has to be built from the uid.
function memberProfileUrl(group: Group, memberUid: string): string {
  if (group === "nogi") return `https://www.nogizaka46.com/s/n46/artist/${memberUid}`
  if (group === "hinata") return `https://www.hinatazaka46.com/s/official/artist/${memberUid}`
  return `https://sakurazaka46.com/s/s46/artist/${memberUid}`
}

function eventUrl(group: Group, event: ScheduleEventEntry): string | undefined {
  if (group === "hinata")
    return event.id !== undefined ? getHinataScheduleEventUrl(event.id) : undefined
  // A nogi recurring event's occurrences share one id, and the detail page renders whichever
  // date the URL carries — so pass the occurrence's own date rather than letting the page fall
  // back to the date the event was first listed.
  if (group === "nogi")
    return event.id !== undefined
      ? getNogiScheduleEventUrl(event.id, new Date(`${event.date}T00:00:00+09:00`))
      : undefined

  const [year, month, day] = event.date.split("-").map(Number)
  return getSakuraScheduleUrl({ year: year!, month: month!, day })
}

// Birthday events for graduated members should stop showing up on birthdays.ics once they've
// actually left — "now" is real wall-clock time (the GitHub Actions run), not `referenceDate`,
// since graduation isn't tied to which JST calendar day the calendar happens to be built for.
function isGraduated(member: Member): boolean {
  return member.graduatedAt !== undefined && new Date(member.graduatedAt).getTime() < Date.now()
}

// Matches sba-background's "メンバー：{name} {name}..." format. Skips uids that don't resolve to
// a roster member instead of leaking a raw internal uid into a user-facing field.
function eventDescription(group: Group, event: ScheduleEventEntry): string | undefined {
  const names = event.member_uids.flatMap(uid => {
    const name = membersByUid[group].get(uid)?.name
    return name !== undefined ? [name] : []
  })
  return names.length > 0 ? `メンバー：${names.join(" ")}` : undefined
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
    title: event.title,
    description: eventDescription(group, event),
    start,
    startInputType: "utc",
    startOutputType: "utc",
    ...("end" in endOrDuration
      ? { endInputType: "utc" as const, endOutputType: "utc" as const }
      : {}),
    ...endOrDuration,
    url: eventUrl(group, event),
    // The displayed label, not the key, is what a calendar client shows.
    categories: event.category_name !== undefined ? [event.category_name] : undefined
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
      e =>
        e.category_key !== BIRTHDAY_CATEGORY_KEY &&
        filters.some(f => isInMonth(e.date, f.year, f.month))
    )
    .map(e => toIcsEvent(group, e))

  const { error, value } = createEvents(events, {
    calName: calNames[group],
    productId: "-//sba-data//schedule//EN"
  })
  if (error) throw error
  return value!
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// A member's all-day birthday event for one calendar year, built entirely from the roster's
// name + birthdate — no schedule data involved. Feb 29 birthdays are observed on Feb 28 in
// non-leap years (the only month/day that can be missing from a target year); age is a plain
// calendar-year difference, so it's unaffected by that shift. Members with no birthdate on
// record can't produce an event and are skipped.
function birthdayEvent(group: Group, member: Member, year: number): EventAttributes | undefined {
  if (member.birthdate === undefined) return undefined

  const [birthYear, month, day] = member.birthdate.split("-").map(Number) as [
    number,
    number,
    number
  ]
  const observedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day
  const date = `${year}-${String(month).padStart(2, "0")}-${String(observedDay).padStart(2, "0")}`

  return {
    // Stable across runs so calendar clients update the same event each year instead of
    // duplicating it: one recurrence per member per year.
    uid: `${group}-birthday-${member.uid}-${year}`,
    title: `🎂 ${member.name}の${year - birthYear}歳の誕生日`,
    // Date-only start/end (no input/output type) makes this a floating all-day event: a birthday
    // is a calendar date, not an instant, so every client shows it on that day in its own local
    // time rather than shifting it by timezone the way a UTC-anchored event would.
    start: [year, month, observedDay],
    end: nextDateArray(date),
    url: memberProfileUrl(group, member.uid),
    categories: [BIRTHDAY_CATEGORY_NAME]
  }
}

// Unlike buildGroupEventsIcs, this is generated from the member roster rather than schedule data,
// and isn't windowed to the current + next JST month. Schedule 誕生日 entries only exist for months
// the fetcher has actually run for, which would leave the calendar full of gaps; the roster has
// every active member's birthdate, so it yields a complete, stable one-year-ahead view (current +
// next calendar year) matching how contacts apps surface birthdays. Graduated members are omitted.
export function buildGroupBirthdaysIcs(group: Group, referenceDate = todayJST()): string {
  const currentYear = Number(referenceDate.split("-")[0])
  const years = [currentYear, currentYear + 1]

  const events = rosters[group]
    .filter(member => !isGraduated(member))
    .flatMap(member => years.flatMap(year => birthdayEvent(group, member, year) ?? []))

  const { error, value } = createEvents(events, {
    calName: `${calNames[group]} Birthdays`,
    productId: "-//sba-data//birthdays//EN"
  })
  if (error) throw error
  return value!
}
