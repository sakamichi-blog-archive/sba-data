import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { hinataMembers, keyakiMembers, sakuraMembers } from "@sakamichi-blog-archive/utils/members"

import type { DayEntry, YearData } from "./types.js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../")
const SBA = join(ROOT, ".sba-contributions")

// Build internal id → uid map.
// For keyaki/hinata/sakura, uid === id (the official website ID is the sequential ID).
// For nogi, id is an internal sequential ID and idOfficial is the uid; parsed from sba-contributions source files.
async function buildIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  for (const m of hinataMembers) map.set(`hinata:${m.uid}`, m.uid)
  for (const m of keyakiMembers) map.set(`keyaki:${m.uid}`, m.uid)
  for (const m of sakuraMembers) map.set(`sakura:${m.uid}`, m.uid)

  const nogiSrc = await readFile(join(SBA, "src/lib/members/nogi.ts"), "utf8")
  for (const [, id, uid] of nogiSrc.matchAll(/id:\s*"(\d+)",?\s*\n\s*idOfficial:\s*"(\d+)"/g)) {
    map.set(`nogi:${id}`, uid)
  }

  return map
}

const idToUid = await buildIdMap()

// Supplemental nogi mappings not present in sba-contributions member files
const nogiSupplemental: Record<string, string> = {
  "00": "40003", // 運営スタッフ
  "04": "254", // 生駒里奈
  "07": "257", // 伊藤万理華
  "10": "260", // 衛藤美彩
  "12": "262", // 川後陽菜
  "13": "263", // 川村真洋
  "15": "265", // 斎藤ちはる
  "16": "266", // 斉藤優里
  "17": "267", // 桜井玲香
  "21": "270", // 中田花奈
  "23": "273", // 西野七瀬
  "24": "274", // 能條愛未
  "33": "283", // 若月佑美
  "81": "40007", // 5期生
  "93": "40008", // 6期生
  "94": "63101", // 愛宕心響
  "95": "63102", // 大越ひなの
  "96": "63103", // 小津玲奈
  "97": "63104", // 海邉朱莉
  "98": "63105", // 川端晃菜
  "99": "63106", // 鈴木佑捺
  "100": "63107", // 瀬戸口心月
  "101": "63108", // 長嶋凛桜
  "102": "63109", // 増田三莉音
  "103": "63110", // 森平麗心
  "104": "63111" // 矢田萌華
}
for (const [id, uid] of Object.entries(nogiSupplemental)) {
  idToUid.set(`nogi:${id}`, uid)
}

// Known data corrections: source entry has garbage id, confirmed correct uid
const corrections: Record<string, Record<string, string>> = {
  "hinata:2022-11-16": { "": "000" } // empty string confirmed as ポカ
}

const groups: { src: string; dest: string }[] = [
  { src: "nogi", dest: "nogi-blogs" },
  { src: "keyaki", dest: "keyaki-blogs" },
  { src: "hinata", dest: "hinata-blogs" },
  { src: "sakura", dest: "sakura-blogs" }
]

interface SrcYear {
  count: number
  days: { date: string; count: number; members: string[] }[]
}

await Promise.all(
  groups.map(async ({ src, dest }) => {
    const srcDir = join(SBA, "data", src)
    const destDir = join(ROOT, dest)
    const files = (await readdir(srcDir)).filter(file => file.endsWith(".json"))

    await Promise.all(
      files.map(async file => {
        const srcData: SrcYear = JSON.parse(await readFile(join(srcDir, file), "utf8"))

        const days: DayEntry[] = srcData.days.map(day => ({
          date: day.date,
          count: day.count,
          members: (day.members ?? [])
            .flatMap(id => {
              const corrected = corrections[`${src}:${day.date}`]?.[id]
              const uid = corrected ?? idToUid.get(`${src}:${id}`)
              if (!uid) {
                console.warn(`  skipping unknown member id "${id}" in ${src}/${file}`)
                return []
              }
              return uid
            })
            .toSorted()
        }))

        const data: YearData = { count: srcData.count, days }
        await writeFile(join(destDir, file), JSON.stringify(data, null, 2) + "\n")
        console.log(`migrated ${dest}/${file}`)
      })
    )
  })
)
