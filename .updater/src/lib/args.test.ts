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

  // A near-miss flag must not fall back to archiving every group — that silently triples the
  // work instead of failing.
  it("rejects a misspelled group flag rather than defaulting to all groups", () => {
    expect(() => parseArchiveArgs(["--groups=nogi"])).toThrow(/Unknown option: --groups=nogi/)
  })

  it("rejects an unknown option", () => {
    expect(() => parseArchiveArgs(["--dry-run"])).toThrow(/Unknown option: --dry-run/)
  })

  it("rejects a repeated group flag", () => {
    expect(() => parseArchiveArgs(["--group=nogi", "--group=hinata"])).toThrow(
      /Repeated option: --group=hinata/
    )
  })

  it("rejects a repeated group flag even when both name the same group", () => {
    expect(() => parseArchiveArgs(["--group=nogi", "--group=nogi"])).toThrow(/Repeated option/)
  })

  it("rejects a second positional argument", () => {
    expect(() => parseArchiveArgs(["2026-07-06", "2026-07-07"])).toThrow(
      /Unexpected argument: 2026-07-07/
    )
  })

  it("rejects a trailing junk positional", () => {
    expect(() => parseArchiveArgs(["2026-07-06", "extra"])).toThrow(/Unexpected argument: extra/)
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
