import { BLOG_COUNT_STEP } from "./constants"
import type { DayData, Segment } from "./years"

const pluralRules = new Intl.PluralRules("en", { type: "ordinal" })
const numberSuffixes: Record<Intl.LDMLPluralRule, string> = {
  few: "rd",
  many: "th",
  one: "st",
  other: "th",
  two: "nd",
  zero: "th"
}

export function getOrdinal(n: number): string {
  return `${n}${numberSuffixes[pluralRules.select(n)]}`
}

export function getDateFormatted(date: string): string {
  const dateObject = new Date(date)
  return `${dateObject.getMonth() + 1}/${dateObject.getDate()}`
}

export function getSquareClassName(count: number): string {
  return count >= BLOG_COUNT_STEP * 3 + 1
    ? "level-5"
    : `level-${Math.ceil(count / BLOG_COUNT_STEP) + 1}`
}

export function getLegendLabel(level: number): string {
  if (level === 1) {
    return "0"
  }
  if (level === 5) {
    return "10-"
  }
  return `${(level - 2) * BLOG_COUNT_STEP + 1}-${(level - 1) * BLOG_COUNT_STEP}`
}

export function getOfficialLink(
  groupKey: string,
  day: DayData,
  memberUid: string | undefined
): string | undefined {
  const dateEightDigit = day.date.replace(/-/g, "")
  const now = new Date()
  const ima = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0")

  let link: string
  switch (groupKey) {
    case "nogi": {
      link = `https://www.nogizaka46.com/s/n46/diary/MEMBER/list?ima=${ima}`
      break
    }
    case "keyaki": {
      link = "https://www.keyakizaka46.com/s/k46o/diary/member/list?ima=0000"
      break
    }
    case "hinata": {
      link = "https://www.hinatazaka46.com/s/official/diary/member/list?ima=0000"
      break
    }
    case "sakura": {
      link = `https://sakurazaka46.com/s/s46/diary/blog/list?ima=${ima}`
      break
    }
    default: {
      return undefined
    }
  }
  if (memberUid !== undefined) {
    link += `&ct=${memberUid}`
  }
  return `${link}&dy=${dateEightDigit}`
}

// Recomputes each day's count against a single member's posts, for the
// member-filter dropdown. Only meaningful when a member is actually
// selected — the unfiltered case already has its count on the segment data.
export function filterSegmentsByMember(
  segments: Segment[],
  memberUid: string
): { segments: Segment[]; count: number } {
  let count = 0
  const filtered = segments.map(segment => ({
    ...segment,
    days: segment.days.map(day => {
      const dayCount = day.members.filter(member => member === memberUid).length
      count += dayCount
      return { ...day, count: dayCount }
    })
  }))
  return { segments: filtered, count }
}
