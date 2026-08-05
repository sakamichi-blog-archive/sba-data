import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import type { Group } from "./types.js"

const BUCKET = "sakamichi-blog-archive-calendars-production"

let client: S3Client | undefined

function getClient(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env["CLOUDFLARE_ACCOUNT_ID"]}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env["CLOUDFLARE_R2_ACCESS_KEY_ID"]!,
      secretAccessKey: process.env["CLOUDFLARE_R2_SECRET_ACCESS_KEY"]!
    }
  })
  return client
}

export async function uploadGroupIcs(group: Group, ics: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${group}/calendar.ics`,
      Body: ics,
      ContentType: "text/calendar; charset=utf-8"
    })
  )
}
