import { afterEach, describe, expect, it, vi } from "vitest"

import { archiveUrls } from "./archive.js"

// Zero delays so the polling loop doesn't slow the suite down.
const fastOptions = { pollIntervalMs: 0, maxWaitMs: 0, submitRetryDelayMs: 0 }

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" }
  })
}

// Answers submit requests with the given responses in order, and any status poll with `status`.
function mockFetch(submitBodies: unknown[], status: unknown = { status: "success" }) {
  let submitCount = 0
  return vi.fn((input: string) => {
    if (input.startsWith("https://web.archive.org/save/status/")) {
      return Promise.resolve(jsonResponse(status))
    }
    const body = submitBodies[submitCount++]
    if (body instanceof Error) return Promise.reject(body)
    return Promise.resolve(jsonResponse(body))
  })
}

function submitCalls(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.filter(([input]) => input === "https://web.archive.org/save/")
}

describe("archiveUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("logs the job id once a capture is submitted", async () => {
    const fetchMock = mockFetch([{ job_id: "job-1" }])
    vi.stubGlobal("fetch", fetchMock)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://web.archive.org/save/",
      expect.objectContaining({ method: "POST" })
    )
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("submitted https://example.com/post")
    )
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("job-1"))
  })

  it("waits for a capture to finish before submitting the next url", async () => {
    const order: string[] = []
    const fetchMock = vi.fn((input: string) => {
      if (input.startsWith("https://web.archive.org/save/status/")) {
        order.push(`status ${input.slice(input.lastIndexOf("/") + 1)}`)
        return Promise.resolve(jsonResponse({ status: "success" }))
      }
      order.push("submit")
      return Promise.resolve(jsonResponse({ job_id: `job-${order.length}` }))
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(
      ["https://example.com/post-1", "https://example.com/post-2"],
      "key",
      "secret",
      fastOptions
    )

    expect(order).toEqual(["submit", "status job-1", "submit", "status job-3"])
  })

  it("keeps polling while the job is pending", async () => {
    let polls = 0
    const fetchMock = vi.fn((input: string) => {
      if (input.startsWith("https://web.archive.org/save/status/")) {
        polls++
        return Promise.resolve(jsonResponse({ status: polls < 3 ? "pending" : "success" }))
      }
      return Promise.resolve(jsonResponse({ job_id: "job-1" }))
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret", {
      pollIntervalMs: 0,
      maxWaitMs: 10_000,
      submitRetryDelayMs: 0
    })

    expect(polls).toBe(3)
  })

  it("gives up waiting once the job exceeds the maximum wait", async () => {
    const fetchMock = mockFetch([{ job_id: "job-1" }], { status: "pending" })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("gave up waiting for job job-1"))
  })

  it("retries submission when the session limit is hit", async () => {
    const fetchMock = mockFetch([
      { message: "You have already reached the limit of active Save Page Now sessions." },
      { job_id: "job-1" }
    ])
    vi.stubGlobal("fetch", fetchMock)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)

    expect(submitCalls(fetchMock)).toHaveLength(2)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("job-1"))
  })

  it("gives up on a url once the session-limit retries are exhausted", async () => {
    const limit = {
      message: "You have already reached the limit of active Save Page Now sessions."
    }
    const fetchMock = mockFetch([limit, limit, limit])
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await archiveUrls(["https://example.com/post"], "key", "secret", {
      ...fastOptions,
      submitRetries: 1
    })

    expect(submitCalls(fetchMock)).toHaveLength(2)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("limit of active"))
  })

  it("strips the query string and fragment before submitting", async () => {
    const fetchMock = mockFetch([{ job_id: "job-1" }])
    vi.stubGlobal("fetch", fetchMock)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(
      ["https://example.com/post?ima=1234&cd=member#section"],
      "key",
      "secret",
      fastOptions
    )

    const [, options] = submitCalls(fetchMock)[0] as unknown as [string, RequestInit]
    expect((options.body as URLSearchParams).get("url")).toBe("https://example.com/post")
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("submitted https://example.com/post ")
    )
  })

  it("warns without throwing when the submit response has no job id", async () => {
    const fetchMock = mockFetch([{ message: "url is blocked from saving" }])
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("url is blocked from saving"))
  })

  it("warns without throwing when the capture job itself fails", async () => {
    const fetchMock = mockFetch([{ job_id: "job-1" }], {
      status: "error",
      message: "live page is not available"
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("live page is not available"))
  })

  it("warns without throwing when the submit request itself fails", async () => {
    const fetchMock = mockFetch([new Error("network down")])
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      archiveUrls(["https://example.com/post"], "key", "secret", fastOptions)
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("network down"))
  })

  it("submits every url even when an earlier one fails", async () => {
    const fetchMock = mockFetch([new Error("network down"), { job_id: "job-2" }])
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(
      ["https://example.com/post-1", "https://example.com/post-2"],
      "key",
      "secret",
      fastOptions
    )

    expect(submitCalls(fetchMock)).toHaveLength(2)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("post-2"))
  })

  it("submits every url even when an earlier one is malformed", async () => {
    const fetchMock = mockFetch([{ job_id: "job-2" }])
    vi.stubGlobal("fetch", fetchMock)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    await archiveUrls(["not a url", "https://example.com/post-2"], "key", "secret", fastOptions)

    expect(submitCalls(fetchMock)).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not a url"))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("post-2"))
  })
})
