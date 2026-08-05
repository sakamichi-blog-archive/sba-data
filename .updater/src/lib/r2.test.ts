import { S3Client } from "@aws-sdk/client-s3"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { uploadGroupIcs } from "./r2.js"

const sendMock = vi.fn()

vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-s3")>("@aws-sdk/client-s3")
  return {
    ...actual,
    S3Client: vi.fn(function MockS3Client(this: { send: typeof sendMock }) {
      this.send = sendMock
    })
  }
})

const S3ClientMock = vi.mocked(S3Client)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct123")
  vi.stubEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", "key123")
  vi.stubEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "secret123")
})

describe("uploadGroupIcs", () => {
  // The client is a module-level singleton (see r2.ts), so its construction is only observable
  // on the first call within this file — later calls/tests reuse it instead of reconstructing it.
  it("puts the ics content at {group}/calendar.ics in the calendars bucket, via a shared R2-configured client", async () => {
    await uploadGroupIcs("hinata", "BEGIN:VCALENDAR...")
    await uploadGroupIcs("nogi", "...")

    expect(S3ClientMock).toHaveBeenCalledTimes(1)
    expect(S3ClientMock).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "key123",
        secretAccessKey: "secret123"
      }
    })

    expect(sendMock).toHaveBeenCalledTimes(2)
    const [hinataCommand, nogiCommand] = sendMock.mock.calls.map(call => call[0]!)
    expect(hinataCommand.input).toMatchObject({
      Bucket: "sakamichi-blog-archive-calendars-production",
      Key: "hinata/calendar.ics",
      Body: "BEGIN:VCALENDAR...",
      ContentType: "text/calendar; charset=utf-8"
    })
    expect(nogiCommand.input).toMatchObject({ Key: "nogi/calendar.ics", Body: "..." })
  })
})
