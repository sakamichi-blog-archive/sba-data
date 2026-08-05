import { readFile, writeFile } from "node:fs/promises"

import {
  fetchHinataBlogs,
  fetchNogiBlog,
  fetchNogiBlogsByDate,
  fetchSakuraBlogs
} from "@sakamichi-blog-archive/utils/blogs"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { daysUpTo, updateGroup, yesterdayJST } from "./blogs.js"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock("@sakamichi-blog-archive/utils/blogs", () => ({
  fetchHinataBlogs: vi.fn(),
  fetchNogiBlog: vi.fn(),
  fetchNogiBlogsByDate: vi.fn(),
  fetchSakuraBlogs: vi.fn()
}))

const readFileMock = vi.mocked(readFile)
const writeFileMock = vi.mocked(writeFile)
const fetchHinataBlogsMock = vi.mocked(fetchHinataBlogs)
const fetchNogiBlogsByDateMock = vi.mocked(fetchNogiBlogsByDate)
const fetchNogiBlogMock = vi.mocked(fetchNogiBlog)
const fetchSakuraBlogsMock = vi.mocked(fetchSakuraBlogs)

function enoent(): NodeJS.ErrnoException {
  const err = new Error("not found") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

describe("yesterdayJST", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("returns the JST calendar date before now, crossing a month boundary", () => {
    // 2024-03-01T00:00:00Z is 2024-03-01T09:00:00 JST
    vi.setSystemTime(new Date("2024-03-01T00:00:00Z"))
    expect(yesterdayJST()).toBe("2024-02-29")
  })

  it("handles the leap-day boundary correctly in a non-leap year", () => {
    vi.setSystemTime(new Date("2023-03-01T00:00:00Z"))
    expect(yesterdayJST()).toBe("2023-02-28")
  })

  it("shifts the UTC date forward when UTC time is still JST's 'today'", () => {
    // 2024-01-01T20:00:00Z is 2024-01-02T05:00:00 JST, so "yesterday" is Jan 1 in both.
    // Pick a time where UTC date and JST-yesterday would differ without the +9h shift:
    // 2024-01-01T16:00:00Z is 2024-01-02T01:00:00 JST -> yesterday JST = 2024-01-01
    vi.setSystemTime(new Date("2024-01-01T16:00:00Z"))
    expect(yesterdayJST()).toBe("2024-01-01")
  })
})

describe("daysUpTo", () => {
  it("returns a single entry when the target date is January 1st", () => {
    const days = daysUpTo("2024-01-01")
    expect(days).toEqual([{ count: 0, date: "2024-01-01", members: [] }])
  })

  it("includes the leap day in a leap year", () => {
    const days = daysUpTo("2024-03-01")
    expect(days).toHaveLength(31 + 29 + 1)
    expect(days.at(-1)).toEqual({ count: 0, date: "2024-03-01", members: [] })
    expect(days.some(d => d.date === "2024-02-29")).toBe(true)
  })

  it("excludes the leap day in a non-leap year", () => {
    const days = daysUpTo("2023-03-01")
    expect(days).toHaveLength(31 + 28 + 1)
    expect(days.some(d => d.date === "2023-02-29")).toBe(false)
  })
})

describe("updateGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new year file when none exists, seeding all prior days", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchHinataBlogsMock.mockResolvedValueOnce({
      blogs: [
        {
          datetime: new Date(),
          memberName: "井口眞緒",
          title: "t",
          uid: 1,
          url: "u",
          html: "",
          images: []
        }
      ],
      html: "",
      url: ""
    } as never)
    fetchHinataBlogsMock.mockResolvedValueOnce({ blogs: [], html: "", url: "" } as never)

    await updateGroup("hinata", "2024-01-03")

    expect(writeFileMock).toHaveBeenCalledTimes(1)
    const [filePath, contents] = writeFileMock.mock.calls[0]!
    expect(filePath).toContain("data/hinata/blogs/2024.json")

    const written = JSON.parse(contents as string)
    expect(written.count).toBe(1)
    expect(written.days).toHaveLength(3)
    expect(written.days.at(-1)).toEqual({ count: 1, date: "2024-01-03", members: ["1"] })
  })

  it("overwrites an existing day entry and recomputes the year total", async () => {
    const existing = {
      count: 5,
      days: [
        { count: 5, date: "2024-01-03", members: ["1", "1", "1", "1", "1"] },
        { count: 0, date: "2024-01-04", members: [] }
      ]
    }
    readFileMock.mockResolvedValue(JSON.stringify(existing))
    fetchHinataBlogsMock.mockResolvedValueOnce({
      blogs: [
        {
          datetime: new Date(),
          memberName: "井口眞緒",
          title: "t",
          uid: 2,
          url: "u",
          html: "",
          images: []
        }
      ],
      html: "",
      url: ""
    } as never)
    fetchHinataBlogsMock.mockResolvedValueOnce({ blogs: [], html: "", url: "" } as never)

    await updateGroup("hinata", "2024-01-03")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.days).toHaveLength(2)
    expect(written.days[0]).toEqual({ count: 1, date: "2024-01-03", members: ["1"] })
    expect(written.count).toBe(1)
  })

  it("drops posts from unknown member names but still counts them toward the day total", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchSakuraBlogsMock.mockResolvedValueOnce({
      blogs: [
        { date: new Date(), memberName: "上村莉菜", title: "t", uid: 1, url: "u" },
        { date: new Date(), memberName: "誰かさん", title: "t", uid: 2, url: "u" }
      ],
      html: "",
      url: ""
    } as never)
    fetchSakuraBlogsMock.mockResolvedValueOnce({ blogs: [], html: "", url: "" } as never)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await updateGroup("sakura", "2024-01-01")

    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.days[0]).toEqual({ count: 2, date: "2024-01-01", members: ["03"] })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("誰かさん"))
  })

  it("resolves each nogi date-summary to its full blog before mapping members", async () => {
    readFileMock.mockRejectedValue(enoent())
    fetchNogiBlogsByDateMock.mockResolvedValueOnce({
      blogs: [{ datetime: new Date(), title: "t", uid: 42, url: "u" }],
      html: "",
      url: ""
    } as never)
    fetchNogiBlogsByDateMock.mockResolvedValueOnce({ blogs: [], html: "", url: "" } as never)
    fetchNogiBlogMock.mockResolvedValue({
      blog: {
        datetime: new Date(),
        memberName: "秋元真夏",
        title: "t",
        uid: 42,
        url: "u",
        html: "",
        images: []
      },
      html: "",
      url: ""
    } as never)

    await updateGroup("nogi", "2024-01-01")

    expect(fetchNogiBlogMock).toHaveBeenCalledWith(42)
    const [, contents] = writeFileMock.mock.calls[0]!
    const written = JSON.parse(contents as string)
    expect(written.days[0]).toEqual({ count: 1, date: "2024-01-01", members: ["7639"] })
  })
})
