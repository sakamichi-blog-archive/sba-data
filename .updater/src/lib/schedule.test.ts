import { readFile, writeFile } from "node:fs/promises"

import {
  fetchHinataScheduleEvent,
  fetchHinataScheduleEvents,
  fetchNogiScheduleEvents,
  fetchSakuraScheduleEvents
} from "@sakamichi-blog-archive/utils/schedule"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { monthsToFetch, todayJST, updateGroupSchedule } from "./schedule.js"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock("@sakamichi-blog-archive/utils/schedule", () => ({
  fetchHinataScheduleEvent: vi.fn(),
  fetchHinataScheduleEvents: vi.fn(),
  fetchNogiScheduleEvents: vi.fn(),
  fetchSakuraScheduleEvents: vi.fn()
}))

const readFileMock = vi.mocked(readFile)
const writeFileMock = vi.mocked(writeFile)
const fetchHinataScheduleEventMock = vi.mocked(fetchHinataScheduleEvent)
const fetchHinataScheduleEventsMock = vi.mocked(fetchHinataScheduleEvents)
const fetchNogiScheduleEventsMock = vi.mocked(fetchNogiScheduleEvents)
const fetchSakuraScheduleEventsMock = vi.mocked(fetchSakuraScheduleEvents)

function enoent(): NodeJS.ErrnoException {
  const err = new Error("not found") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

function jstMidnight(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`)
}

describe("todayJST", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("returns the current JST calendar date, crossing a month boundary", () => {
    // 2024-02-29T15:30:00Z is 2024-03-01T00:30:00 JST
    vi.setSystemTime(new Date("2024-02-29T15:30:00Z"))
    expect(todayJST()).toBe("2024-03-01")
  })

  it("returns the leap day itself in a leap year", () => {
    // 2024-02-29T10:00:00Z is 2024-02-29T19:00:00 JST
    vi.setSystemTime(new Date("2024-02-29T10:00:00Z"))
    expect(todayJST()).toBe("2024-02-29")
  })

  it("shifts the UTC date forward when UTC time is still JST's 'today'", () => {
    // 2024-01-01T20:00:00Z is 2024-01-02T05:00:00 JST
    vi.setSystemTime(new Date("2024-01-01T20:00:00Z"))
    expect(todayJST()).toBe("2024-01-02")
  })
})

describe("monthsToFetch", () => {
  it("returns the current and next month within the same year", () => {
    expect(monthsToFetch("2026-08-15")).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 }
    ])
  })

  it("rolls over to next year in December", () => {
    expect(monthsToFetch("2026-12-01")).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 }
    ])
  })
})

describe("updateGroupSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchHinataScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
    fetchNogiScheduleEventsMock.mockResolvedValue({ events: [], js: "", url: "" })
    fetchSakuraScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
  })

  it("writes structured events for nogi, resolving member names to uids", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchNogiScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "live",
          categoryName: "配信",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: ["秋元真夏"],
          timeStart: "18:00",
          timeEnd: "19:00",
          title: "Live",
          url: "https://example.com/e1"
        }
      ],
      js: "",
      url: ""
    })

    await updateGroupSchedule("nogi", "2026-08-15")

    const [filePath, contents] = writeFileMock.mock.calls[0]!
    expect(filePath).toContain("data/nogi/schedule/2026.json")
    const written = JSON.parse(contents as string)
    expect(written.count).toBe(1)
    expect(written.events).toEqual([
      {
        date: "2026-08-05",
        category_key: "live",
        category_name: "配信",
        title: "Live",
        member_uids: ["7639"],
        time_start: "18:00",
        time_end: "19:00",
        id: "e1"
      }
    ])
  })

  it("fetches hinata event detail once per unique id to resolve members", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-03"),
          id: "r1",
          title: "Radio"
        },
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-10"),
          id: "r1",
          title: "Radio"
        }
      ],
      html: "",
      url: ""
    })
    fetchHinataScheduleEventMock.mockResolvedValue({
      event: {
        categoryKey: "",
        categoryName: "",
        date: jstMidnight("2026-08-03"),
        html: "",
        id: "r1",
        members: ["井口眞緒"],
        title: "Radio"
      },
      html: "",
      url: ""
    })

    await updateGroupSchedule("hinata", "2026-08-15")

    expect(fetchHinataScheduleEventMock).toHaveBeenCalledTimes(1)
    expect(fetchHinataScheduleEventMock).toHaveBeenCalledWith("r1")
    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events.map((e: { member_uids: string[] }) => e.member_uids)).toEqual([
      ["1"],
      ["1"]
    ])
  })

  // The two are independently absent: nogi resolves a name only for keys the site's category nav
  // covers, so an uncovered key yields a key with no name, while hinata/sakura read the key off a
  // class and the name off the rendered text, either of which can be missing on its own.
  it("omits whichever of category_key/category_name the site didn't give", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "media",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: [],
          title: "Key only"
        },
        {
          categoryKey: "",
          categoryName: "ライブ",
          date: jstMidnight("2026-08-06"),
          html: "",
          id: "e2",
          members: [],
          title: "Name only"
        }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("sakura", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events[0]).toMatchObject({ title: "Key only", category_key: "media" })
    expect(written.events[0]).not.toHaveProperty("category_name")
    expect(written.events[1]).toMatchObject({ title: "Name only", category_name: "ライブ" })
    expect(written.events[1]).not.toHaveProperty("category_key")
  })

  it("drops events with unknown member names but keeps the event", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: ["誰かさん"],
          title: "Event"
        }
      ],
      html: "",
      url: ""
    })
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await updateGroupSchedule("sakura", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events[0].member_uids).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("誰かさん"))
  })

  it("replaces only the fetched month's events, keeping other months untouched", async () => {
    const existing = {
      count: 2,
      events: [
        { date: "2026-07-20", title: "Old July event", member_uids: [] },
        { date: "2026-08-01", title: "Stale August event", member_uids: [] }
      ]
    }
    readFileMock.mockResolvedValue(JSON.stringify(existing))
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-12"),
          html: "",
          id: "e2",
          members: [],
          title: "Fresh August event"
        }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("sakura", "2026-08-15")

    const augustCall = writeFileMock.mock.calls.find(call =>
      (call[0] as string).includes("2026.json")
    )!
    const written = JSON.parse(augustCall[1] as string)
    expect(written.events).toEqual([
      { date: "2026-07-20", title: "Old July event", member_uids: [] },
      {
        date: "2026-08-12",
        category_key: undefined,
        category_name: undefined,
        title: "Fresh August event",
        member_uids: [],
        time_start: undefined,
        time_end: undefined,
        id: "e2"
      }
    ])
  })

  it("fetches both months sequentially so a shared year file reflects both updates", async () => {
    readFileMock.mockRejectedValueOnce(enoent())
    readFileMock.mockImplementationOnce(async () => writeFileMock.mock.calls[0]![1] as string)
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-20"),
          html: "",
          id: "e1",
          members: [],
          title: "August event"
        }
      ],
      html: "",
      url: ""
    })
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-09-05"),
          html: "",
          id: "e2",
          members: [],
          title: "September event"
        }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("sakura", "2026-08-15")

    expect(writeFileMock).toHaveBeenCalledTimes(2)
    const [, secondContents] = writeFileMock.mock.calls[1]!
    const written = JSON.parse(secondContents as string)
    expect(written.events.map((e: { title: string }) => e.title)).toEqual([
      "August event",
      "September event"
    ])
  })
})

describe("hinata member detail fetching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchHinataScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
    fetchNogiScheduleEventsMock.mockResolvedValue({ events: [], js: "", url: "" })
    fetchSakuraScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
  })

  it("fetches detail once per unique id even when it recurs across both fetched months", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-03"),
          id: "r1",
          title: "Radio"
        }
      ],
      html: "",
      url: ""
    })
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-09-07"),
          id: "r1",
          title: "Radio"
        }
      ],
      html: "",
      url: ""
    })
    fetchHinataScheduleEventMock.mockResolvedValue({
      event: {
        categoryKey: "",
        categoryName: "",
        date: jstMidnight("2026-08-03"),
        html: "",
        id: "r1",
        members: ["井口眞緒"],
        title: "Radio"
      },
      html: "",
      url: ""
    })

    await updateGroupSchedule("hinata", "2026-08-15")

    expect(fetchHinataScheduleEventMock).toHaveBeenCalledTimes(1)
  })

  it("resolves an event with no id to empty members without calling the detail fetch", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        { categoryKey: "", categoryName: "", date: jstMidnight("2026-08-03"), title: "No id event" }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("hinata", "2026-08-15")

    expect(fetchHinataScheduleEventMock).not.toHaveBeenCalled()
    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events[0].member_uids).toEqual([])
  })

  it("treats a failed detail fetch as empty members instead of aborting the whole update", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-03"),
          id: "r1",
          title: "Radio"
        }
      ],
      html: "",
      url: ""
    })
    fetchHinataScheduleEventMock.mockRejectedValue(new Error("boom"))
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await updateGroupSchedule("hinata", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events[0].member_uids).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("r1"))
  })
})

describe("date-membership filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchHinataScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
    fetchNogiScheduleEventsMock.mockResolvedValue({ events: [], js: "", url: "" })
    fetchSakuraScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
  })

  it("drops fetched events whose date falls outside the requested month", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: [],
          title: "In month"
        },
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-07-31"),
          html: "",
          id: "e2",
          members: [],
          title: "Spillover"
        }
      ],
      html: "",
      url: ""
    })
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await updateGroupSchedule("sakura", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events.map((e: { title: string }) => e.title)).toEqual(["In month"])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Spillover"))
  })
})

describe("compareEvents ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchHinataScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
    fetchNogiScheduleEventsMock.mockResolvedValue({ events: [], js: "", url: "" })
    fetchSakuraScheduleEventsMock.mockResolvedValue({ events: [], html: "", url: "" })
  })

  it("sorts same-date events by time_start, with undefined last", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: [],
          timeStart: "20:00",
          title: "Evening"
        },
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e2",
          members: [],
          title: "No time"
        },
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e3",
          members: [],
          timeStart: "09:00",
          title: "Morning"
        }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("sakura", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events.map((e: { title: string }) => e.title)).toEqual([
      "Morning",
      "Evening",
      "No time"
    ])
  })

  it("falls back to title order for events sharing a date and time_start", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e1",
          members: [],
          timeStart: "18:00",
          title: "Zebra"
        },
        {
          categoryKey: "",
          categoryName: "",
          date: jstMidnight("2026-08-05"),
          html: "",
          id: "e2",
          members: [],
          timeStart: "18:00",
          title: "Apple"
        }
      ],
      html: "",
      url: ""
    })

    await updateGroupSchedule("sakura", "2026-08-15")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.events.map((e: { title: string }) => e.title)).toEqual(["Apple", "Zebra"])
  })
})
