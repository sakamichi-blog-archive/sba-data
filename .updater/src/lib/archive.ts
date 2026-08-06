const SAVE_ENDPOINT = "https://web.archive.org/save/"

interface SubmitResponse {
  job_id?: string
  message?: string
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
  for (const url of urls) {
    try {
      // Sequential by design: daily volume is small and SPN2 rate limits concurrent jobs per account.
      // oxlint-disable-next-line no-await-in-loop
      const jobId = await submitCapture(url, accessKey, secretKey)
      console.log(`submitted ${url} for archiving (job ${jobId})`)
    } catch (err) {
      console.warn(`failed to submit ${url} for archiving: ${(err as Error).message}`)
    }
  }
}
