import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import dayjs from "dayjs"

import { groups } from "./groups"

// Astro bundles this module at build time, so import.meta.url no longer
// points at its source location — resolve from the CLI's cwd instead
// (astro dev/build always run with .web as the working directory).
const REPO_ROOT = path.resolve(process.cwd(), "..")

export interface DayData {
  count: number
  date: string
  members: string[]
}

export interface MonthLabel {
  name: string
  weekIndex: number
}

export interface Segment {
  days: DayData[]
  months: MonthLabel[]
  offset: number
}

export interface YearData {
  count: number
  segments: Segment[]
  year: number
}

interface RawYearData {
  count: number
  days: DayData[]
}

export interface GroupYears {
  englishShort: string
  key: string
  years: number[]
}

function groupDataDir(group: string): string {
  return path.join(REPO_ROOT, `${group}-blogs`)
}

export function getGroupYears(): GroupYears[] {
  return groups
    .filter(group => existsSync(groupDataDir(group.key)))
    .map(group => {
      const years = readdirSync(groupDataDir(group.key))
        .filter(fileName => /^\d+\.json$/i.test(fileName))
        .map(fileName => Number(path.basename(fileName, ".json")))
        .toSorted((a, b) => b - a)

      return { englishShort: group.englishShort, key: group.key, years }
    })
}

export function getYearData(group: string, year: string): YearData {
  const jsonPath = path.join(groupDataDir(group), `${year}.json`)
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as RawYearData

  return {
    count: raw.count,
    segments: buildSegments(raw.days),
    year: Number(year)
  }
}

// A year's grid is split into multiple horizontal segments once it grows
// past roughly half a year, so each block stays a reasonable width. Below
// that threshold, this returns the total week count so the split condition
// in buildSegments (weekIndex > maxWeeks) can never trigger.
function getMaxWeeksPerSegment(days: DayData[], offset: number): number {
  const weekCount = Math.ceil((offset + days.length) / 7)
  if (weekCount <= 26) {
    return weekCount
  }

  const monthsPresent = new Set(days.map(day => day.date.slice(0, 7)))
  return monthsPresent.size < 12 ? Math.round((offset + days.length - 4) / 7 / 2) : 24
}

// Splits a year's days into calendar-grid segments (one segment per rendered
// block of weeks). Short/in-progress years fit in a single segment; full
// years are split roughly in half so each block stays a reasonable width.
function buildSegments(days: DayData[]): Segment[] {
  if (days.length === 0) {
    return []
  }

  const offset = dayjs(days[0].date).day()
  const maxWeeks = getMaxWeeksPerSegment(days, offset)

  const segments: Segment[] = []
  let segmentIndex = 0
  let weekIndex = 0

  days.forEach((day, index) => {
    if (index > 0) {
      if (dayjs(day.date).day() === 0) {
        weekIndex++
      }
      if (weekIndex > maxWeeks && dayjs(day.date).date() === 1) {
        segmentIndex++
        weekIndex = 0
      }
    }

    let segment = segments[segmentIndex]
    if (segment === undefined) {
      segment = { days: [], months: [], offset: dayjs(day.date).day() }
      segments.push(segment)
    }

    if (segment.days.length === 0 || dayjs(day.date).date() === 1) {
      const existingIndex = segment.months.findIndex(month => month.weekIndex === weekIndex)
      if (existingIndex !== -1) {
        segment.months.splice(existingIndex, 1)
      }
      segment.months.push({ name: dayjs(day.date).format("MMM"), weekIndex })
    }

    segment.days.push(day)
  })

  return segments
}
