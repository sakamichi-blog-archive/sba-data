import { readFile } from "node:fs/promises"

import {
  getHinataScheduleEventUrl,
  getNogiScheduleEventUrl,
  getSakuraScheduleUrl
} from "@sakamichi-blog-archive/utils/schedule"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildGroupIcs } from "./ics.js"
import type { ScheduleEventEntry, ScheduleYearData } from "./types.js"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn()
}))

vi.mock("@sakamichi-blog-archive/utils/schedule", () => ({
  getHinataScheduleEventUrl: vi.fn((id: string) => `https://hinata.example/${id}`),
  getNogiScheduleEventUrl: vi.fn((id: string) => `https://nogi.example/${id}`),
  getSakuraScheduleUrl: vi.fn(
    (filter: { year: number; month: number; day?: number }) =>
      `https://sakura.example/${filter.year}-${filter.month}-${filter.day}`
  )
}))

const readFileMock = vi.mocked(readFile)
const getHinataScheduleEventUrlMock = vi.mocked(getHinataScheduleEventUrl)
const getNogiScheduleEventUrlMock = vi.mocked(getNogiScheduleEventUrl)
const getSakuraScheduleUrlMock = vi.mocked(getSakuraScheduleUrl)

function yearData(events: ScheduleEventEntry[]): ScheduleYearData {
  return { count: events.length, events }
}

function enoent(): NodeJS.ErrnoException {
  const err = new Error("not found") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

function parseEvents(ics: string): Record<string, string>[] {
  const blocks = ics.split("BEGIN:VEVENT\r\n").slice(1)
  return blocks.map(block => {
    const body = block.split("END:VEVENT")[0]!
    const fields: Record<string, string> = {}
    for (const line of body.trimEnd().split("\r\n")) {
      const [key, ...rest] = line.split(":")
      fields[key!] = rest.join(":")
    }
    return fields
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-05T00:00:00Z"))
})

describe("buildGroupIcs", () => {
  it("drops events outside the current and next JST month", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-07-31", title: "Too early", member_uids: [] },
          { date: "2026-08-01", title: "In range", member_uids: [] },
          { date: "2026-10-01", title: "Too late", member_uids: [] }
        ])
      )
    )

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY)).toEqual(["In range"])
  })

  it("converts a timed JST event to UTC and defaults a 1h duration when time_end is absent", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-01",
            title: "Radio",
            member_uids: [],
            time_start: "08:30"
          }
        ])
      )
    )

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DTSTART).toBe("20260731T233000Z")
    expect(event!.DURATION).toBe("PT1H")
  })

  it("converts both start and end times when time_end is present", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-01",
            title: "Show",
            member_uids: [],
            time_start: "09:30",
            time_end: "10:00"
          }
        ])
      )
    )

    const ics = await buildGroupIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DTSTART).toBe("20260801T003000Z")
    expect(event!.DTEND).toBe("20260801T010000Z")
  })

  it("treats an event with no time_start as a whole-day event ending the next day", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Release", member_uids: [] }]))
    )

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!["DTSTART;VALUE=DATE"]).toBe("20260801")
    expect(event!["DTEND;VALUE=DATE"]).toBe("20260802")
  })

  it("builds a stable uid from group, id, and date", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Radio", member_uids: [], id: "e1" }]))
    )

    const ics = await buildGroupIcs("hinata", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.UID).toBe("hinata-e1-2026-08-01")
  })

  it("falls back to a hash-based uid when id is missing", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "No id event", member_uids: [] }]))
    )

    const ics = await buildGroupIcs("hinata", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.UID).toMatch(/^hinata-[0-9a-f]{12}$/)
  })

  it("derives hinata and nogi event urls from id via the utils package", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Radio", member_uids: [], id: "e1" }]))
    )

    const hinataIcs = await buildGroupIcs("hinata", "2026-08-05")
    expect(parseEvents(hinataIcs)[0]!.URL).toBe("https://hinata.example/e1")
    expect(getHinataScheduleEventUrlMock).toHaveBeenCalledWith("e1")

    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Show", member_uids: [], id: "e2" }]))
    )
    const nogiIcs = await buildGroupIcs("nogi", "2026-08-05")
    expect(parseEvents(nogiIcs)[0]!.URL).toBe("https://nogi.example/e2")
    expect(getNogiScheduleEventUrlMock).toHaveBeenCalledWith("e2")
  })

  it("builds a nogi birthday event's url from the member's artist page instead of id", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-08",
            category: "誕生日",
            title: "Birthday",
            member_uids: ["48008"],
            id: "100058"
          }
        ])
      )
    )

    const ics = await buildGroupIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.URL).toBe("https://www.nogizaka46.com/s/n46/artist/48008")
    expect(getNogiScheduleEventUrlMock).not.toHaveBeenCalled()
  })

  it("derives a sakura event url as a date-scoped listing link", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-12", title: "Event", member_uids: [] }]))
    )

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.URL).toBe("https://sakura.example/2026-8-12")
    expect(getSakuraScheduleUrlMock).toHaveBeenCalledWith({ year: 2026, month: 8, day: 12 })
  })

  it("sets CATEGORIES only when the event has a category", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-01", title: "With category", member_uids: [], category: "ライブ" },
          { date: "2026-08-02", title: "No category", member_uids: [] }
        ])
      )
    )

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events[0]!.CATEGORIES).toBe("ライブ")
    expect(events[1]!.CATEGORIES).toBeUndefined()
  })

  it("reads both year files and merges events when the month range crosses a year boundary", async () => {
    readFileMock.mockImplementation(async (path: unknown) => {
      const p = path as string
      if (p.endsWith("2026.json")) {
        return JSON.stringify(
          yearData([{ date: "2026-12-15", title: "December", member_uids: [] }])
        )
      }
      if (p.endsWith("2027.json")) {
        return JSON.stringify(yearData([{ date: "2027-01-10", title: "January", member_uids: [] }]))
      }
      throw enoent()
    })

    const ics = await buildGroupIcs("sakura", "2026-12-20")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY).toSorted()).toEqual(["December", "January"])
  })

  it("treats a missing year file as having no events instead of throwing", async () => {
    readFileMock.mockRejectedValue(enoent())

    const ics = await buildGroupIcs("sakura", "2026-08-05")

    expect(parseEvents(ics)).toEqual([])
  })
})
