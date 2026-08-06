import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { archiveUrls } from "./archive.js"

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" }
  })
}

describe("archiveUrls", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.WAYBACK_ACCESS_KEY = "key"
    process.env.WAYBACK_SECRET_KEY = "secret"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("skips archiving and warns when credentials are missing", async () => {
    delete process.env.WAYBACK_ACCESS_KEY
    delete process.env.WAYBACK_SECRET_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("WAYBACK_ACCESS_KEY"))
  })

  it("logs success once the capture job reports success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job_id: "job-1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "success", timestamp: "20260806000000" }))
    vi.stubGlobal("fetch", fetchMock)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://web.archive.org/save/",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://web.archive.org/save/status/job-1",
      expect.anything()
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("archived https://example.com/post")
    )
  })

  it("warns without throwing when the capture job reports an error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job_id: "job-1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "error", status_ext: "error:blocked" }))
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(archiveUrls(["https://example.com/post"])).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("error:blocked"))
  })

  it("warns without throwing when the submit request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(archiveUrls(["https://example.com/post"])).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("network down"))
  })

  it("gives up and warns after polling times out", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job_id: "job-1" }))
      .mockImplementation(async () => jsonResponse({ status: "pending" }))
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const promise = archiveUrls(["https://example.com/post"])
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    await promise

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("timed out"))
  })
})
