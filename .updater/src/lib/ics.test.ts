import { readFile } from "node:fs/promises"

import {
  getHinataScheduleEventUrl,
  getNogiScheduleEventUrl,
  getSakuraScheduleUrl
} from "@sakamichi-blog-archive/utils/schedule"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildGroupBirthdaysIcs, buildGroupEventsIcs } from "./ics.js"
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

vi.mock("@sakamichi-blog-archive/utils/members", () => ({
  hinataMembers: [
    {
      uid: "25",
      name: "石塚瑶季",
      nameSpaced: "石塚 瑶季",
      nameEnglish: "",
      birthdate: "2000-08-06"
    },
    {
      uid: "26",
      name: "小坂菜緒",
      nameSpaced: "小坂 菜緒",
      nameEnglish: "",
      birthdate: "2001-01-01"
    }
  ],
  nogiMembers: [
    {
      uid: "48008",
      name: "賀喜遥香",
      nameSpaced: "賀喜 遥香",
      nameEnglish: "",
      birthdate: "2000-08-08"
    }
  ],
  sakuraMembers: [
    { uid: "67", name: "村井優", nameSpaced: "村井 優", nameEnglish: "", birthdate: "1999-08-18" },
    {
      uid: "68",
      name: "うるう年生",
      nameSpaced: "うるう 年生",
      nameEnglish: "",
      birthdate: "2000-02-29"
    },
    {
      uid: "70",
      name: "卒業花子",
      nameSpaced: "卒業 花子",
      nameEnglish: "",
      birthdate: "1999-05-01",
      graduatedAt: "2020-01-01T00:00:00Z"
    },
    {
      uid: "71",
      name: "未来卒業子",
      nameSpaced: "未来 卒業子",
      nameEnglish: "",
      birthdate: "1999-05-01",
      graduatedAt: "2030-01-01T00:00:00Z"
    }
  ]
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

describe("buildGroupEventsIcs", () => {
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

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

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

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

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

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DTSTART).toBe("20260801T003000Z")
    expect(event!.DTEND).toBe("20260801T010000Z")
  })

  it("treats an event with no time_start as a whole-day event ending the next day", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Release", member_uids: [] }]))
    )

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!["DTSTART;VALUE=DATE"]).toBe("20260801")
    expect(event!["DTEND;VALUE=DATE"]).toBe("20260802")
  })

  it("builds a stable uid from group, id, and date", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Radio", member_uids: [], id: "e1" }]))
    )

    const ics = await buildGroupEventsIcs("hinata", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.UID).toBe("hinata-e1-2026-08-01")
  })

  it("falls back to a hash-based uid when id is missing", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "No id event", member_uids: [] }]))
    )

    const ics = await buildGroupEventsIcs("hinata", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.UID).toMatch(/^hinata-[0-9a-f]{12}$/)
  })

  it("derives hinata and nogi event urls from id via the utils package", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Radio", member_uids: [], id: "e1" }]))
    )

    const hinataIcs = await buildGroupEventsIcs("hinata", "2026-08-05")
    expect(parseEvents(hinataIcs)[0]!.URL).toBe("https://hinata.example/e1")
    expect(getHinataScheduleEventUrlMock).toHaveBeenCalledWith("e1")

    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Show", member_uids: [], id: "e2" }]))
    )
    const nogiIcs = await buildGroupEventsIcs("nogi", "2026-08-05")
    expect(parseEvents(nogiIcs)[0]!.URL).toBe("https://nogi.example/e2")
    expect(getNogiScheduleEventUrlMock).toHaveBeenCalledWith("e2")
  })

  it("excludes birthday-category events from the events calendar", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-08", category: "誕生日", title: "Birthday", member_uids: ["48008"] },
          { date: "2026-08-09", title: "Regular event", member_uids: [] }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY)).toEqual(["Regular event"])
  })

  it("derives a sakura event url as a date-scoped listing link", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-12", title: "Event", member_uids: [] }]))
    )

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

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

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events[0]!.CATEGORIES).toBe("ライブ")
    expect(events[1]!.CATEGORIES).toBeUndefined()
  })

  it("sets a メンバー-prefixed description from member_uids, space-joining unspaced names", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "Live", member_uids: ["25", "26"] }]))
    )

    const ics = await buildGroupEventsIcs("hinata", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DESCRIPTION).toBe("メンバー：石塚瑶季 小坂菜緒")
  })

  it("omits the description when the event has no member_uids", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(yearData([{ date: "2026-08-01", title: "No members", member_uids: [] }]))
    )

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DESCRIPTION).toBeUndefined()
  })

  it("skips member_uids that don't resolve to a roster member instead of leaking the raw uid", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([{ date: "2026-08-01", title: "Live", member_uids: ["67", "unknown-uid"] }])
      )
    )

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DESCRIPTION).toBe("メンバー：村井優")
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

    const ics = await buildGroupEventsIcs("sakura", "2026-12-20")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY).toSorted()).toEqual(["December", "January"])
  })

  it("treats a missing year file as having no events instead of throwing", async () => {
    readFileMock.mockRejectedValue(enoent())

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    expect(parseEvents(ics)).toEqual([])
  })
})

describe("buildGroupBirthdaysIcs", () => {
  it("includes only 誕生日-category events", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-08", category: "誕生日", title: "Birthday", member_uids: ["48008"] },
          { date: "2026-08-09", title: "Regular event", member_uids: [] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("nogi", "2026-08-05")

    const events = parseEvents(ics)
    expect(events).toHaveLength(1)
    expect(events[0]!.SUMMARY).toBe("🎂 賀喜遥香の26歳の誕生日")
  })

  it("spans the current and next full calendar year, not just the current and next month", async () => {
    readFileMock.mockImplementation(async (path: unknown) => {
      const p = path as string
      if (p.endsWith("2026.json")) {
        return JSON.stringify(
          yearData([
            { date: "2026-01-15", category: "誕生日", title: "Early in year", member_uids: [] }
          ])
        )
      }
      if (p.endsWith("2027.json")) {
        return JSON.stringify(
          yearData([
            { date: "2027-12-20", category: "誕生日", title: "Late next year", member_uids: [] }
          ])
        )
      }
      throw enoent()
    })

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY).toSorted()).toEqual(["Early in year", "Late next year"])
  })

  it("formats a birthday title with the member's unspaced name and age", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-18", category: "誕生日", title: "村井 優の誕生日", member_uids: ["67"] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.SUMMARY).toBe("🎂 村井優の27歳の誕生日")
  })

  it("falls back to the raw title when the member has no birthdate on record", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-01", category: "誕生日", title: "Unknown member", member_uids: ["999"] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.SUMMARY).toBe("Unknown member")
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
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.URL).toBe("https://www.nogizaka46.com/s/n46/artist/48008")
    expect(getNogiScheduleEventUrlMock).not.toHaveBeenCalled()
  })

  it("computes the correct age for a leap-day birthdate observed in a non-leap year", async () => {
    // Age comes from subtracting calendar years, not from diffing dates, so it's unaffected by
    // which day (Feb 28 or Mar 1) the source site lands a Feb 29 birthday on in a non-leap year.
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-03-01",
            category: "誕生日",
            title: "うるう年生の誕生日",
            member_uids: ["68"]
          }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.SUMMARY).toBe("🎂 うるう年生の26歳の誕生日")
  })

  it("builds hinata and sakura birthday event urls from the member's profile page too", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-06",
            category: "誕生日",
            title: "Birthday",
            member_uids: ["25"],
            id: "e1"
          }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const hinataIcs = await buildGroupBirthdaysIcs("hinata", "2026-08-05")
    expect(parseEvents(hinataIcs)[0]!.URL).toBe("https://www.hinatazaka46.com/s/official/artist/25")
    expect(getHinataScheduleEventUrlMock).not.toHaveBeenCalled()

    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-18", category: "誕生日", title: "Birthday", member_uids: ["67"] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const sakuraIcs = await buildGroupBirthdaysIcs("sakura", "2026-08-05")
    expect(parseEvents(sakuraIcs)[0]!.URL).toBe("https://sakurazaka46.com/s/s46/artist/67")
    expect(getSakuraScheduleUrlMock).not.toHaveBeenCalled()
  })

  it("omits birthday events for members who have already graduated", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-05-01", category: "誕生日", title: "Graduated", member_uids: ["70"] },
          {
            date: "2026-05-01",
            category: "誕生日",
            title: "Not yet graduated",
            member_uids: ["71"]
          },
          { date: "2026-08-18", category: "誕生日", title: "Active", member_uids: ["67"] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY).toSorted()).toEqual([
      "🎂 未来卒業子の27歳の誕生日",
      "🎂 村井優の27歳の誕生日"
    ])
  })

  it("does not set a description, since the title already names the member", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-18", category: "誕生日", title: "Birthday", member_uids: ["67"] }
        ])
      )
    )
    readFileMock.mockRejectedValueOnce(enoent())

    const ics = await buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DESCRIPTION).toBeUndefined()
  })
})
