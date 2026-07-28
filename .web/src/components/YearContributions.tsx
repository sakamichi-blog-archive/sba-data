import { type ChangeEvent, useMemo, useState } from "react"

import { BLOG_COUNT_STEP } from "../lib/constants"
import type { MemberGeneration } from "../lib/members"
import type { DayData, Segment } from "../lib/years"

interface YearContributionsProps {
  count: number
  generations: MemberGeneration[]
  groupKey: string
  groupName: string
  segments: Segment[]
  year: number
}

const pluralRules = new Intl.PluralRules("en", { type: "ordinal" })
const numberSuffixes: Record<Intl.LDMLPluralRule, string> = {
  few: "rd",
  many: "th",
  one: "st",
  other: "th",
  two: "nd",
  zero: "th"
}
function getOrdinal(n: number): string {
  return `${n}${numberSuffixes[pluralRules.select(n)]}`
}

function getDateFormatted(date: string): string {
  const dateObject = new Date(date)
  return `${dateObject.getMonth() + 1}/${dateObject.getDate()}`
}

function getClassName(count: number): string {
  return count >= BLOG_COUNT_STEP * 3 + 1
    ? "level-5"
    : `level-${Math.ceil(count / BLOG_COUNT_STEP) + 1}`
}

function getOfficialLink(
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

function getInitialMemberUid(): string | undefined {
  if (typeof window === "undefined") {
    return undefined
  }
  return new URLSearchParams(window.location.search).get("member") ?? undefined
}

export default function YearContributions({
  count,
  generations,
  groupKey,
  groupName,
  segments,
  year
}: YearContributionsProps) {
  const [memberUid, setMemberUid] = useState<string | undefined>(getInitialMemberUid)
  const [activeSquare, setActiveSquare] = useState<string>()

  const members = useMemo(
    () => generations.flatMap(generation => generation.members),
    [generations]
  )
  const selectedMember = members.find(member => member.uid === memberUid)

  const { filteredSegments, filteredCount } = useMemo(
    () => filterSegments(segments, memberUid),
    [segments, memberUid]
  )

  const daysCount = filteredSegments.reduce((sum, segment) => sum + segment.days.length, 0)
  const displayCount = memberUid !== undefined ? filteredCount : count

  function handleMemberChange(event: ChangeEvent<HTMLSelectElement>): void {
    setActiveSquare(undefined)
    const uid = event.target.value === "" ? undefined : event.target.value
    setMemberUid(uid)

    const url = new URL(window.location.href)
    if (uid === undefined) {
      url.searchParams.delete("member")
    } else {
      url.searchParams.set("member", uid)
    }
    window.history.pushState({}, "", url)
  }

  return (
    <>
      <div className="year">
        <h1 className="year__title">
          {selectedMember?.nameEnglish ?? groupName} {year}{" "}
          <span>
            {displayCount} contribution{displayCount !== 1 ? "s" : ""}
            {displayCount > 1 && <> ({(displayCount / daysCount).toFixed(1)} per day)</>}
          </span>
        </h1>
        <div className="year__contributions">
          {filteredSegments.map((segment, segmentIndex) => (
            <div className="year__contributions__segment" key={segmentIndex}>
              <ul className="year__contributions__segment__months">
                {segment.months.map((month, i) => (
                  <li style={{ gridColumn: `${month.weekIndex + 1}` }} key={i}>
                    {month.name}
                  </li>
                ))}
              </ul>
              <ul className="year__contributions__segment__days">
                <li>Sun</li>
                <li>Mon</li>
                <li>Tue</li>
                <li>Wed</li>
                <li>Thu</li>
                <li>Fri</li>
                <li>Sat</li>
              </ul>
              <ul className="year__contributions__segment__squares">
                {segment.days.map((day, dayIndex) => (
                  <li
                    className={
                      getClassName(day.count) + (activeSquare === day.date ? " focused" : "")
                    }
                    style={{ gridRowStart: dayIndex === 0 ? segment.offset + 1 : undefined }}
                    key={day.date}
                    onClick={() => setActiveSquare(day.date)}
                  >
                    {day.count}
                    {day.count > 0 && (
                      <a
                        className="link"
                        href={getOfficialLink(groupKey, day, memberUid)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedMember?.nameEnglish ?? groupName} {getDateFormatted(day.date)}
                      </a>
                    )}
                    <span>
                      {getDateFormatted(day.date)}: {day.count} post{day.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="year__contributions__legend">
            <ul className="colors">
              {[1, 2, 3, 4, 5].map(n => (
                <li key={n}>
                  <span className={`square level-${n}`}></span>
                  <span>
                    {n === 1
                      ? "0"
                      : n === 5
                        ? "10-"
                        : `${(n - 2) * BLOG_COUNT_STEP + 1}-${(n - 1) * BLOG_COUNT_STEP}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="member-filter">
        <select value={memberUid ?? ""} onChange={handleMemberChange}>
          <option value="">Filter by member</option>
          {generations.map(({ generation, members: generationMembers }) => (
            <optgroup label={`${getOrdinal(generation.seq)} generation`} key={generation.key}>
              {generationMembers.map(member => (
                <option key={member.uid} value={member.uid}>
                  {member.nameEnglish}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <a href="/" className="back-home">
        ← Back home
      </a>
    </>
  )
}

function filterSegments(
  segments: Segment[],
  memberUid: string | undefined
): { filteredSegments: Segment[]; filteredCount: number } {
  if (memberUid === undefined) {
    const count = segments.reduce(
      (sum, segment) => sum + segment.days.reduce((s, day) => s + day.count, 0),
      0
    )
    return { filteredSegments: segments, filteredCount: count }
  }

  let filteredCount = 0
  const filteredSegments = segments.map(segment => ({
    ...segment,
    days: segment.days.map(day => {
      const dayCount = day.members.filter(member => member === memberUid).length
      filteredCount += dayCount
      return { ...day, count: dayCount }
    })
  }))
  return { filteredSegments, filteredCount }
}
