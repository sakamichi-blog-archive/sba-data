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
          category: "配信",
          date: jstMidnight("2026-08-05"),
          group: "nogi",
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
        category: "配信",
        title: "Live",
        member_uids: ["7639"],
        time_start: "18:00",
        time_end: "19:00",
        id: "e1",
        url: "https://example.com/e1"
      }
    ])
  })

  it("fetches hinata event detail once per unique id to resolve members", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataScheduleEventsMock.mockResolvedValueOnce({
      events: [
        { date: jstMidnight("2026-08-03"), group: "hinata", id: "r1", title: "Radio" },
        { date: jstMidnight("2026-08-10"), group: "hinata", id: "r1", title: "Radio" }
      ],
      html: "",
      url: ""
    })
    fetchHinataScheduleEventMock.mockResolvedValue({
      event: {
        date: jstMidnight("2026-08-03"),
        group: "hinata",
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

  it("drops events with unknown member names but keeps the event", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          date: jstMidnight("2026-08-05"),
          group: "sakura",
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
          date: jstMidnight("2026-08-12"),
          group: "sakura",
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
        category: undefined,
        title: "Fresh August event",
        member_uids: [],
        time_start: undefined,
        time_end: undefined,
        id: "e2",
        url: undefined
      }
    ])
  })

  it("fetches both months sequentially so a shared year file reflects both updates", async () => {
    readFileMock.mockRejectedValueOnce(enoent())
    readFileMock.mockImplementationOnce(async () => writeFileMock.mock.calls[0]![1] as string)
    fetchSakuraScheduleEventsMock.mockResolvedValueOnce({
      events: [
        {
          date: jstMidnight("2026-08-20"),
          group: "sakura",
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
          date: jstMidnight("2026-09-05"),
          group: "sakura",
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
