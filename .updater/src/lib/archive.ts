const SAVE_ENDPOINT = "https://web.archive.org/save/"
const STATUS_ENDPOINT = "https://web.archive.org/save/status/"

// Save Page Now allows at most a handful of concurrent capture sessions per account, so each
// capture is polled to completion before the next is submitted. Even then the account's session
// slot can still be occupied by a job from an earlier run, hence the retry on submission.
const DEFAULT_POLL_INTERVAL_MS = 5_000
const DEFAULT_MAX_WAIT_MS = 180_000
const DEFAULT_SUBMIT_RETRIES = 5
const DEFAULT_SUBMIT_RETRY_DELAY_MS = 60_000

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
  submitRetries?: number
  submitRetryDelayMs?: number
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

function isSessionLimit(message: string): boolean {
  return message.includes("limit of active")
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

// Retries only the session-limit error — any other failure is permanent for this URL and is
// left to the caller to log.
async function submitCaptureWithRetry(
  url: string,
  accessKey: string,
  secretKey: string,
  retries: number,
  retryDelayMs: number
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      // Sequential by design: one capture at a time keeps the account within its session limit.
      // oxlint-disable-next-line no-await-in-loop
      return await submitCapture(url, accessKey, secretKey)
    } catch (err) {
      const message = (err as Error).message
      if (attempt >= retries || !isSessionLimit(message)) throw err
      console.log(`session limit reached, waiting ${retryDelayMs}ms before retrying ${url}`)
      // oxlint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs)
    }
  }
}

// Polls the job until it leaves the pending state so the account's session slot is free before
// the next URL is submitted. Gives up after maxWaitMs rather than blocking the run forever — a
// still-pending job keeps running server-side, it just isn't waited on any longer.
async function waitForCapture(
  jobId: string,
  accessKey: string,
  secretKey: string,
  pollIntervalMs: number,
  maxWaitMs: number
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs)
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(`${STATUS_ENDPOINT}${jobId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `LOW ${accessKey}:${secretKey}`
      }
    })
    // oxlint-disable-next-line no-await-in-loop
    const data = (await res.json()) as StatusResponse
    if (data.status === "success") return
    if (data.status === "error") throw new Error(data.message ?? `job ${jobId} failed`)
    if (Date.now() >= deadline) {
      console.warn(`gave up waiting for job ${jobId} to finish; it may still complete`)
      return
    }
  }
}

// Submits each URL to the Wayback Machine's Save Page Now API, one at a time, waiting for each
// capture to finish before starting the next. Never throws on an individual URL failure — that's
// only logged, since one bad URL must never block the rest of the batch.
export async function archiveUrls(
  urls: string[],
  accessKey: string,
  secretKey: string,
  options: ArchiveOptions = {}
): Promise<void> {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    submitRetries = DEFAULT_SUBMIT_RETRIES,
    submitRetryDelayMs = DEFAULT_SUBMIT_RETRY_DELAY_MS
  } = options

  for (const rawUrl of urls) {
    try {
      const url = normalizeUrl(rawUrl)
      // oxlint-disable-next-line no-await-in-loop
      const jobId = await submitCaptureWithRetry(
        url,
        accessKey,
        secretKey,
        submitRetries,
        submitRetryDelayMs
      )
      console.log(`submitted ${url} for archiving (job ${jobId})`)
      // oxlint-disable-next-line no-await-in-loop
      await waitForCapture(jobId, accessKey, secretKey, pollIntervalMs, maxWaitMs)
      console.log(`archived ${url}`)
    } catch (err) {
      console.warn(`failed to archive ${rawUrl}: ${(err as Error).message}`)
    }
  }
}
