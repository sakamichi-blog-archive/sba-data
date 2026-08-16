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
  // Mirrors utils' real signature, and folds the date into the returned URL so the occurrence
  // date shows up in the generated ics rather than only in the call arguments. Like utils, it
  // reads the date's JST calendar day.
  getNogiScheduleEventUrl: vi.fn((id: string, date?: Date) => {
    if (date === undefined) return `https://nogi.example/${id}`
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return `https://nogi.example/${id}?d=${jst}`
  }),
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
    },
    { uid: "99999", name: "誕生日不明", nameSpaced: "誕生日 不明", nameEnglish: "" }
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
    expect(parseEvents(nogiIcs)[0]!.URL).toBe("https://nogi.example/e2?d=2026-08-01")
  })

  // The reason getNogiScheduleEventUrl is given a date at all: a recurring nogi event's
  // occurrences share one id, and the detail page renders whichever date the url carries, so
  // without a per-occurrence date every occurrence would link to the same day.
  it("gives each occurrence of a recurring nogi event its own dated url", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          { date: "2026-08-01", title: "Weekly show", member_uids: [], id: "e2" },
          { date: "2026-08-08", title: "Weekly show", member_uids: [], id: "e2" },
          { date: "2026-09-05", title: "Weekly show", member_uids: [], id: "e2" }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    expect(parseEvents(ics).map(e => e.URL)).toEqual([
      "https://nogi.example/e2?d=2026-08-01",
      "https://nogi.example/e2?d=2026-08-08",
      "https://nogi.example/e2?d=2026-09-05"
    ])
  })

  // DTSTART is UTC, so an early-morning JST event starts on the previous UTC day. The url is
  // dated from the stored JST date and so stays on the event's own calendar day, which is the
  // day the site expects — the two legitimately disagree here.
  it("dates a nogi url by the JST day while DTSTART lands on the previous UTC day", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-08",
            title: "Late show",
            member_uids: [],
            id: "e3",
            time_start: "01:00"
          }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.DTSTART).toBe("20260807T160000Z")
    expect(event!.URL).toBe("https://nogi.example/e3?d=2026-08-08")
  })

  it("excludes birthday-category events from the events calendar", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-08",
            category_key: "birthday",
            category_name: "誕生日",
            title: "Birthday",
            member_uids: ["48008"]
          },
          { date: "2026-08-09", title: "Regular event", member_uids: [] }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY)).toEqual(["Regular event"])
  })

  // Keying the exclusion off category_key rather than the displayed label is the point of storing
  // both: the site can relabel 誕生日 without birthdays leaking into the events calendar.
  it("excludes birthday events by key even when the displayed label has changed", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-08",
            category_key: "birthday",
            category_name: "お誕生日",
            title: "Birthday",
            member_uids: ["48008"]
          }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    expect(parseEvents(ics)).toEqual([])
  })

  it("keeps a non-birthday event whose label merely reads 誕生日", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify(
        yearData([
          {
            date: "2026-08-08",
            category_key: "live",
            category_name: "誕生日",
            title: "Birthday live",
            member_uids: []
          }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("nogi", "2026-08-05")

    expect(parseEvents(ics).map(e => e.SUMMARY)).toEqual(["Birthday live"])
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
          {
            date: "2026-08-01",
            title: "With category",
            member_uids: [],
            category_key: "event",
            category_name: "ライブ"
          },
          { date: "2026-08-02", title: "No category", member_uids: [] },
          // A key the site's category nav doesn't cover is stored with no name; CATEGORIES
          // carries the label, so there's nothing to emit.
          { date: "2026-08-03", title: "Key only", member_uids: [], category_key: "media" }
        ])
      )
    )

    const ics = await buildGroupEventsIcs("sakura", "2026-08-05")

    const events = parseEvents(ics)
    expect(events[0]!.CATEGORIES).toBe("ライブ")
    expect(events[1]!.CATEGORIES).toBeUndefined()
    expect(events[2]!.CATEGORIES).toBeUndefined()
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
  it("generates one birthday per active member per year straight from the roster", () => {
    // No schedule files are read — birthdays come from the member roster alone.
    const ics = buildGroupBirthdaysIcs("nogi", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.map(e => e.SUMMARY).toSorted()).toEqual([
      "🎂 賀喜遥香の26歳の誕生日",
      "🎂 賀喜遥香の27歳の誕生日"
    ])
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("spans the current and next full calendar year, not just the current and next month", () => {
    // 小坂菜緒's Jan 1 birthday is months behind the Aug reference date, yet still appears — the
    // roster-driven calendar covers whole years, so nothing is dropped for being out of a window.
    const ics = buildGroupBirthdaysIcs("hinata", "2026-08-05")

    const koakina = parseEvents(ics).filter(e => e.SUMMARY.includes("小坂菜緒"))
    expect(koakina.map(e => e["DTSTART;VALUE=DATE"]).toSorted()).toEqual(["20260101", "20270101"])
  })

  it("formats a birthday title with the member's unspaced name and age", () => {
    const ics = buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const event = parseEvents(ics).find(e => e["DTSTART;VALUE=DATE"] === "20260818")
    expect(event!.SUMMARY).toBe("🎂 村井優の27歳の誕生日")
  })

  it("skips members with no birthdate on record", () => {
    // The nogi roster includes 誕生日不明, who has no birthdate; only 賀喜遥香's events appear.
    const ics = buildGroupBirthdaysIcs("nogi", "2026-08-05")

    const events = parseEvents(ics)
    expect(events.every(e => e.SUMMARY.includes("賀喜遥香"))).toBe(true)
    expect(events.some(e => e.SUMMARY.includes("誕生日不明"))).toBe(false)
  })

  it("builds a nogi birthday event's url from the member's artist page instead of id", () => {
    const ics = buildGroupBirthdaysIcs("nogi", "2026-08-05")

    const [event] = parseEvents(ics)
    expect(event!.URL).toBe("https://www.nogizaka46.com/s/n46/artist/48008")
    expect(getNogiScheduleEventUrlMock).not.toHaveBeenCalled()
  })

  it("observes a Feb 29 birthdate on Feb 28 in non-leap years, with the age still correct", () => {
    // 2026 and 2027 are both non-leap, so うるう年生's Feb 29 birthdate lands on Feb 28. Age is a
    // plain calendar-year difference, unaffected by the day shift.
    const ics = buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const leap = parseEvents(ics).filter(e => e.SUMMARY.includes("うるう年生"))
    expect(leap.map(e => e["DTSTART;VALUE=DATE"]).toSorted()).toEqual(["20260228", "20270228"])
    expect(leap.find(e => e["DTSTART;VALUE=DATE"] === "20260228")!.SUMMARY).toBe(
      "🎂 うるう年生の26歳の誕生日"
    )
  })

  it("builds hinata and sakura birthday event urls from the member's profile page too", () => {
    const hinataIcs = buildGroupBirthdaysIcs("hinata", "2026-08-05")
    const ishizuka = parseEvents(hinataIcs).find(e => e.SUMMARY.includes("石塚瑶季"))
    expect(ishizuka!.URL).toBe("https://www.hinatazaka46.com/s/official/artist/25")
    expect(getHinataScheduleEventUrlMock).not.toHaveBeenCalled()

    const sakuraIcs = buildGroupBirthdaysIcs("sakura", "2026-08-05")
    const murai = parseEvents(sakuraIcs).find(e => e.SUMMARY.includes("村井優"))
    expect(murai!.URL).toBe("https://sakurazaka46.com/s/s46/artist/67")
    expect(getSakuraScheduleUrlMock).not.toHaveBeenCalled()
  })

  it("omits birthday events for members who have already graduated", () => {
    // The sakura roster has 卒業花子 (graduated 2020) and 未来卒業子 (graduates 2030); only the
    // latter — still active as of the 2026 run — keeps her birthday.
    const ics = buildGroupBirthdaysIcs("sakura", "2026-08-05")

    const names = parseEvents(ics).map(e => e.SUMMARY)
    expect(names.some(n => n.includes("未来卒業子"))).toBe(true)
    expect(names.some(n => n.includes("卒業花子"))).toBe(false)
  })

  it("does not set a description, since the title already names the member", () => {
    const ics = buildGroupBirthdaysIcs("sakura", "2026-08-05")

    for (const event of parseEvents(ics)) {
      expect(event.DESCRIPTION).toBeUndefined()
    }
  })
})
