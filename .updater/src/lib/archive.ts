const SAVE_ENDPOINT = "https://web.archive.org/save/"
const STATUS_ENDPOINT = "https://web.archive.org/save/status/"

// Save Page Now allows at most a handful of concurrent capture sessions per account, so each
// capture is polled to completion before the next is submitted.
const DEFAULT_POLL_INTERVAL_MS = 5_000
const DEFAULT_MAX_WAIT_MS = 180_000
// A failed submission isn't retried — the post is simply skipped — but the next URL waits, so a
// full session pool has a chance to drain instead of the whole batch failing back to back.
const DEFAULT_FAILURE_DELAY_MS = 60_000

interface SubmitResponse {
  job_id?: string
  message?: string
}

interface StatusResponse {
  status?: "pending" | "success" | "error"
  message?: string
  timestamp?: string
}

export interface ArchiveOptions {
  pollIntervalMs?: number
  maxWaitMs?: number
  failureDelayMs?: number
}

// Blog detail pages are fully identified by their path alone; the query string is just
// site-generated noise (e.g. a request-echoed cache-buster) that differs on every fetch and
// would otherwise fragment the same post across many distinct-looking archived URLs.
function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.search = ""
  parsed.hash = ""
  return parsed.href
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function submitCapture(url: string, accessKey: string, secretKey: string): Promise<string> {
  const res = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `LOW ${accessKey}:${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ url, if_not_archived_within: "86400" })
  })
  const data = (await res.json()) as SubmitResponse
  if (!data.job_id) throw new Error(data.message ?? `unexpected response submitting ${url}`)
  return data.job_id
}

// Polls the job until it leaves the pending state so the account's session slot is free before
// the next URL is submitted. Returns false if it gave up after maxWaitMs rather than blocking the
// run forever — a still-pending job keeps running server-side, so its slot also stays occupied.
async function waitForCapture(
  jobId: string,
  accessKey: string,
  secretKey: string,
  pollIntervalMs: number,
  maxWaitMs: number
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs)

    let data: StatusResponse
    try {
      // oxlint-disable-next-line no-await-in-loop
      const res = await fetch(`${STATUS_ENDPOINT}${jobId}`, {
        headers: {
          Accept: "application/json",
          Authorization: `LOW ${accessKey}:${secretKey}`
        }
      })
      // oxlint-disable-next-line no-await-in-loop
      data = (await res.json()) as StatusResponse
    } catch (err) {
      // Failing to read the status says nothing about the capture — it's still running and still
      // holding a session. Returning here would let the next URL be submitted on top of it, so
      // keep polling until the deadline and only then give up.
      if (Date.now() >= deadline) return false
      console.warn(`status check for job ${jobId} failed, still waiting: ${(err as Error).message}`)
      continue
    }

    if (data.status === "success") return true
    if (data.status === "error") throw new Error(data.message ?? `job ${jobId} failed`)
    if (Date.now() >= deadline) return false
  }
}

// Submits each URL to the Wayback Machine's Save Page Now API, one at a time, waiting for each
// capture to finish before starting the next. Never throws on an individual URL failure — that's
// only logged, since one bad URL must never block the rest of the batch. A URL whose submission
// fails is skipped rather than retried, bounding the cost of a bad post at one failureDelayMs.
export async function archiveUrls(
  urls: string[],
  accessKey: string,
  secretKey: string,
  options: ArchiveOptions = {}
): Promise<void> {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    failureDelayMs = DEFAULT_FAILURE_DELAY_MS
  } = options

  for (const rawUrl of urls) {
    let url: string
    try {
      url = normalizeUrl(rawUrl)
    } catch (err) {
      // A local parse failure involves no session, so there's nothing to wait for.
      console.warn(`skipping malformed url ${rawUrl}: ${(err as Error).message}`)
      continue
    }

    let jobId: string
    try {
      // oxlint-disable-next-line no-await-in-loop
      jobId = await submitCapture(url, accessKey, secretKey)
    } catch (err) {
      console.warn(`failed to submit ${url} for archiving: ${(err as Error).message}`)
      // oxlint-disable-next-line no-await-in-loop
      await sleep(failureDelayMs)
      continue
    }
    console.log(`submitted ${url} for archiving (job ${jobId})`)

    try {
      // oxlint-disable-next-line no-await-in-loop
      const captured = await waitForCapture(jobId, accessKey, secretKey, pollIntervalMs, maxWaitMs)
      if (captured) console.log(`archived ${url}`)
      else console.warn(`gave up waiting for job ${jobId} (${url}); it may still complete`)
    } catch (err) {
      console.warn(`failed to archive ${url}: ${(err as Error).message}`)
    }
  }
}
