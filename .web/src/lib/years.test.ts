import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildSegments, getMaxWeeksPerSegment, type DayData } from "./years.js"

let originalTz: string | undefined

beforeAll(() => {
  originalTz = process.env.TZ
  process.env.TZ = "UTC"
})

afterAll(() => {
  if (originalTz === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTz
  }
})

function daysFrom(startDate: string, count: number): DayData[] {
  const days: DayData[] = []
  const d = new Date(`${startDate}T00:00:00Z`)
  for (let i = 0; i < count; i++) {
    days.push({ count: 0, date: d.toISOString().slice(0, 10), members: [] })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

describe("getMaxWeeksPerSegment", () => {
  it("returns the total week count when the range is short", () => {
    // offset 0, 100 days -> ceil(100/7) = 15 weeks, under the 26-week threshold
    expect(getMaxWeeksPerSegment(daysFrom("2024-01-01", 100), 0)).toBe(15)
  })

  it("splits roughly in half when the range exceeds 26 weeks but spans fewer than 12 months", () => {
    // 200 days from Jan 1 spans Jan-Jul (7 months), weekCount = ceil(200/7) = 29 > 26
    const days = daysFrom("2024-01-01", 200)
    const monthsPresent = new Set(days.map(d => d.date.slice(0, 7)))
    expect(monthsPresent.size).toBeLessThan(12)
    expect(getMaxWeeksPerSegment(days, 0)).toBe(Math.round((0 + 200 - 4) / 7 / 2))
  })

  it("caps at 24 weeks per segment for a full 12-month year", () => {
    const days = daysFrom("2024-01-01", 366)
    const monthsPresent = new Set(days.map(d => d.date.slice(0, 7)))
    expect(monthsPresent.size).toBe(12)
    expect(getMaxWeeksPerSegment(days, 1)).toBe(24)
  })
})

describe("buildSegments", () => {
  it("returns no segments for an empty year", () => {
    expect(buildSegments([])).toEqual([])
  })

  it("puts a short partial year into a single segment with one month label", () => {
    const days = daysFrom("2024-01-01", 10)
    const segments = buildSegments(days)

    expect(segments).toHaveLength(1)
    expect(segments[0]!.days).toHaveLength(10)
    expect(segments[0]!.offset).toBe(1) // 2024-01-01 is a Monday
    expect(segments[0]!.months).toEqual([{ name: "Jan", weekIndex: 0 }])
  })

  it("splits a full leap year into segments that together account for every day", () => {
    const days = daysFrom("2024-01-01", 366)
    const segments = buildSegments(days)

    expect(segments.length).toBeGreaterThan(1)
    const total = segments.reduce((sum, s) => sum + s.days.length, 0)
    expect(total).toBe(366)
    // Every segment boundary starts on the 1st of a month.
    for (const segment of segments.slice(1)) {
      expect(segment.days[0]!.date.endsWith("-01")).toBe(true)
    }
  })

  it("splits a full non-leap year into segments that together account for every day", () => {
    const days = daysFrom("2023-01-01", 365)
    const segments = buildSegments(days)

    expect(segments.length).toBeGreaterThan(1)
    const total = segments.reduce((sum, s) => sum + s.days.length, 0)
    expect(total).toBe(365)
  })

  it("relabels a month whose first day falls on the same week index as an earlier label", () => {
    const days = daysFrom("2024-01-01", 40)
    const segments = buildSegments(days)

    // Only the most recent month label at a given weekIndex should survive.
    const weekIndexes = segments[0]!.months.map(m => m.weekIndex)
    expect(new Set(weekIndexes).size).toBe(weekIndexes.length)
  })
})
