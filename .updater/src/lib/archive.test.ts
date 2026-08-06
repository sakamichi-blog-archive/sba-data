import { afterEach, describe, expect, it, vi } from "vitest"

import { archiveUrls } from "./archive.js"

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" }
  })
}

describe("archiveUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("logs the job id once a capture is submitted", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ job_id: "job-1" }))
    vi.stubGlobal("fetch", fetchMock)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://web.archive.org/save/",
      expect.objectContaining({ method: "POST" })
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("submitted https://example.com/post")
    )
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("job-1"))
  })

  it("warns without throwing when the submit response has no job id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "url is blocked from saving" }))
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      archiveUrls(["https://example.com/post"], "key", "secret")
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("url is blocked from saving"))
  })

  it("warns without throwing when the submit request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      archiveUrls(["https://example.com/post"], "key", "secret")
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("network down"))
  })

  it("submits every url even when an earlier one fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse({ job_id: "job-2" }))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post-1", "https://example.com/post-2"], "key", "secret")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("post-2"))
  })
})
