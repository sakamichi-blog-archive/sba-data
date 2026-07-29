import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  filterSegmentsByMember,
  getDateFormatted,
  getLegendLabel,
  getOfficialLink,
  getOrdinal,
  getSquareClassName
} from "./contributions.js"
import type { DayData, Segment } from "./years.js"

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

describe("getOrdinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"]
  ])("formats %i as %s", (n, expected) => {
    expect(getOrdinal(n)).toBe(expected)
  })
})

describe("getDateFormatted", () => {
  it("formats an ISO date as M/D", () => {
    expect(getDateFormatted("2024-03-05")).toBe("3/5")
    expect(getDateFormatted("2024-12-31")).toBe("12/31")
  })
})

describe("getSquareClassName", () => {
  it.each([
    [0, "level-1"],
    [1, "level-2"],
    [3, "level-2"],
    [4, "level-3"],
    [6, "level-3"],
    [7, "level-4"],
    [9, "level-4"],
    [10, "level-5"],
    [100, "level-5"]
  ])("classifies count %i as %s", (count, expected) => {
    expect(getSquareClassName(count)).toBe(expected)
  })
})

describe("getLegendLabel", () => {
  it.each([
    [1, "0"],
    [2, "1-3"],
    [3, "4-6"],
    [4, "7-9"],
    [5, "10-"]
  ])("labels level %i as %s", (level, expected) => {
    expect(getLegendLabel(level)).toBe(expected)
  })
})

describe("getOfficialLink", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const day: DayData = { count: 1, date: "2024-03-05", members: ["1"] }

  it("returns undefined for an unknown group", () => {
    expect(getOfficialLink("unknown", day, undefined)).toBeUndefined()
  })

  it("uses a fixed ima for keyaki and hinata, ignoring the current time", () => {
    expect(getOfficialLink("keyaki", day, undefined)).toBe(
      "https://www.keyakizaka46.com/s/k46o/diary/member/list?ima=0000&dy=20240305"
    )
    expect(getOfficialLink("hinata", day, undefined)).toBe(
      "https://www.hinatazaka46.com/s/official/diary/member/list?ima=0000&dy=20240305"
    )
  })

  it("derives ima from the current time for nogi and sakura", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-03-05T08:07:00"))

    expect(getOfficialLink("nogi", day, undefined)).toBe(
      "https://www.nogizaka46.com/s/n46/diary/MEMBER/list?ima=0807&dy=20240305"
    )
    expect(getOfficialLink("sakura", day, undefined)).toBe(
      "https://sakurazaka46.com/s/s46/diary/blog/list?ima=0807&dy=20240305"
    )
  })

  it("appends the member uid as ct when given", () => {
    expect(getOfficialLink("hinata", day, "42")).toBe(
      "https://www.hinatazaka46.com/s/official/diary/member/list?ima=0000&ct=42&dy=20240305"
    )
  })
})

describe("filterSegmentsByMember", () => {
  it("recomputes each day's count against a single member and totals across segments", () => {
    const segments: Segment[] = [
      {
        days: [
          { count: 3, date: "2024-01-01", members: ["1", "2", "1"] },
          { count: 0, date: "2024-01-02", members: [] }
        ],
        months: [],
        offset: 0
      },
      {
        days: [{ count: 2, date: "2024-01-08", members: ["1", "1"] }],
        months: [],
        offset: 0
      }
    ]

    const { segments: filtered, count } = filterSegmentsByMember(segments, "1")

    expect(count).toBe(4)
    expect(filtered[0]!.days[0]).toEqual({ count: 2, date: "2024-01-01", members: ["1", "2", "1"] })
    expect(filtered[0]!.days[1]).toEqual({ count: 0, date: "2024-01-02", members: [] })
    expect(filtered[1]!.days[0]).toEqual({ count: 2, date: "2024-01-08", members: ["1", "1"] })

    // Original segments are left untouched.
    expect(segments[0]!.days[0]!.count).toBe(3)
  })
})
