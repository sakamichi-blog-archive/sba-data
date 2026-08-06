const SAVE_ENDPOINT = "https://web.archive.org/save/"
const STATUS_ENDPOINT = "https://web.archive.org/save/status"
const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 2 * 60 * 1000

interface SubmitResponse {
  job_id?: string
  message?: string
}

interface StatusResponse {
  status: "pending" | "success" | "error"
  status_ext?: string
  message?: string
  timestamp?: string
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

async function pollCapture(
  jobId: string,
  accessKey: string,
  secretKey: string
): Promise<StatusResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  // Polling by necessity: SPN2 has no push notification, only a status endpoint to re-check.
  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(`${STATUS_ENDPOINT}/${jobId}`, {
      headers: { Authorization: `LOW ${accessKey}:${secretKey}` }
    })
    // oxlint-disable-next-line no-await-in-loop
    const data = (await res.json()) as StatusResponse
    if (data.status !== "pending") return data
    // oxlint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return { status: "error", message: "timed out waiting for capture to complete" }
}

// Submits each URL to the Wayback Machine's Save Page Now API and waits for it to complete.
// Never throws: a failed or timed-out capture is only logged, since this must never block
// the caller's other work (e.g. committing data-JSON changes).
export async function archiveUrls(urls: string[]): Promise<void> {
  const accessKey = process.env.WAYBACK_ACCESS_KEY
  const secretKey = process.env.WAYBACK_SECRET_KEY
  if (!accessKey || !secretKey) {
    console.warn("WAYBACK_ACCESS_KEY/WAYBACK_SECRET_KEY not set — skipping archive step")
    return
  }

  for (const url of urls) {
    try {
      // Sequential by design: daily volume is small and SPN2 rate limits concurrent jobs per account.
      // oxlint-disable-next-line no-await-in-loop
      const jobId = await submitCapture(url, accessKey, secretKey)
      // oxlint-disable-next-line no-await-in-loop
      const result = await pollCapture(jobId, accessKey, secretKey)
      if (result.status === "success") {
        console.log(`archived ${url} (timestamp ${result.timestamp ?? "unknown"})`)
      } else {
        console.warn(
          `failed to archive ${url}: ${result.status_ext ?? result.message ?? "unknown error"}`
        )
      }
    } catch (err) {
      console.warn(`failed to archive ${url}: ${(err as Error).message}`)
    }
  }
}
