import { type ChangeEvent, type KeyboardEvent, useMemo, useState } from "react"

import {
  filterSegmentsByMember,
  getDateFormatted,
  getLegendLabel,
  getOfficialLink,
  getOrdinal,
  getSquareClassName
} from "../lib/contributions"
import type { MemberGeneration } from "../lib/members"
import type { Segment } from "../lib/years"

interface YearContributionsProps {
  count: number
  generations: MemberGeneration[]
  groupKey: string
  groupName: string
  segments: Segment[]
  year: number
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
  const displayName = selectedMember?.nameEnglish ?? groupName

  const { filteredSegments, displayCount } = useMemo(() => {
    if (memberUid === undefined) {
      return { filteredSegments: segments, displayCount: count }
    }
    const filtered = filterSegmentsByMember(segments, memberUid)
    return { filteredSegments: filtered.segments, displayCount: filtered.count }
  }, [segments, memberUid, count])

  const daysCount = filteredSegments.reduce((sum, segment) => sum + segment.days.length, 0)

  function handleSquareKeyDown(event: KeyboardEvent<HTMLLIElement>, date: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setActiveSquare(date)
    }
  }

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
          {displayName} {year}{" "}
          <span>
            {displayCount} contribution{displayCount !== 1 ? "s" : ""}
            {displayCount > 1 && <> ({(displayCount / daysCount).toFixed(1)} per day)</>}
          </span>
        </h1>
        <div className="year__contributions">
          {filteredSegments.map((segment, segmentIndex) => (
            <div className="year__contributions__segment" key={segmentIndex}>
              <ul className="year__contributions__segment__months">
                {segment.months.map(month => (
                  <li style={{ gridColumn: `${month.weekIndex + 1}` }} key={month.weekIndex}>
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
                      getSquareClassName(day.count) + (activeSquare === day.date ? " focused" : "")
                    }
                    style={{ gridRowStart: dayIndex === 0 ? segment.offset + 1 : undefined }}
                    key={day.date}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSquare(day.date)}
                    onKeyDown={event => handleSquareKeyDown(event, day.date)}
                  >
                    {day.count}
                    {day.count > 0 && (
                      <a
                        className="link"
                        href={getOfficialLink(groupKey, day, memberUid)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {displayName} {getDateFormatted(day.date)}
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
              {[1, 2, 3, 4, 5].map(level => (
                <li key={level}>
                  <span className={`square level-${level}`}></span>
                  <span>{getLegendLabel(level)}</span>
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
