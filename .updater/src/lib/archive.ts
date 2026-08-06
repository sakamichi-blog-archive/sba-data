const SAVE_ENDPOINT = "https://web.archive.org/save/"

interface SubmitResponse {
  job_id?: string
  message?: string
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

// Submits each URL to the Wayback Machine's Save Page Now API. Fire-and-forget: doesn't poll
// the job to completion, and never throws on an individual submission failure — that's only
// logged, since one bad URL must never block the rest of the batch.
export async function archiveUrls(
  urls: string[],
  accessKey: string,
  secretKey: string
): Promise<void> {
  for (const rawUrl of urls) {
    try {
      const url = normalizeUrl(rawUrl)
      // Sequential by design: daily volume is small and SPN2 rate limits concurrent jobs per account.
      // oxlint-disable-next-line no-await-in-loop
      const jobId = await submitCapture(url, accessKey, secretKey)
      console.log(`submitted ${url} for archiving (job ${jobId})`)
    } catch (err) {
      console.warn(`failed to submit ${rawUrl} for archiving: ${(err as Error).message}`)
    }
  }
}
