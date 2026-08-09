import { describe, expect, it } from "vitest"

import { ALL_GROUPS, parseArchiveArgs } from "./args.js"

describe("parseArchiveArgs", () => {
  it("defaults to every group when no arguments are given", () => {
    expect(parseArchiveArgs([])).toEqual({ date: undefined, groups: ALL_GROUPS })
  })

  it("reads the date from the lone positional argument", () => {
    expect(parseArchiveArgs(["2026-07-06"])).toEqual({
      date: "2026-07-06",
      groups: ALL_GROUPS
    })
  })

  it("narrows to a single group", () => {
    expect(parseArchiveArgs(["2026-07-06", "--group=nogi"])).toEqual({
      date: "2026-07-06",
      groups: ["nogi"]
    })
  })

  it("accepts the group flag before the date", () => {
    expect(parseArchiveArgs(["--group=sakura", "2026-07-06"])).toEqual({
      date: "2026-07-06",
      groups: ["sakura"]
    })
  })

  // The reason only `--group=` is supported: a space-separated value would land in the date
  // positional here and be reported as an invalid date.
  it("does not mistake a lone group flag for the date", () => {
    expect(parseArchiveArgs(["--group=hinata"])).toEqual({
      date: undefined,
      groups: ["hinata"]
    })
  })

  it("rejects an unknown group", () => {
    expect(() => parseArchiveArgs(["--group=keyaki"])).toThrow(/Invalid group: keyaki/)
  })

  it("rejects an empty group value", () => {
    expect(() => parseArchiveArgs(["--group="])).toThrow(/Invalid group/)
  })

  it.each(["2026-13-99", "2026-02-30", "20260706", "not-a-date"])(
    "rejects the malformed date %s",
    date => {
      expect(() => parseArchiveArgs([date])).toThrow(/Invalid date/)
    }
  )

  it("rejects a malformed date even when the group is valid", () => {
    expect(() => parseArchiveArgs(["2026-13-99", "--group=nogi"])).toThrow(/Invalid date/)
  })

  it("accepts a leap day that exists", () => {
    expect(parseArchiveArgs(["2028-02-29"]).date).toBe("2028-02-29")
  })

  it("rejects a leap day that does not exist", () => {
    expect(() => parseArchiveArgs(["2027-02-29"])).toThrow(/Invalid date/)
  })
})
