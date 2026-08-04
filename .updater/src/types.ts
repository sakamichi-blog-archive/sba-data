// data/keyaki/blogs/ is historical data only — Keyakizaka46 became Sakurazaka46 in 2020
// and no longer has an active blog or schedule.
export type Group = "hinata" | "nogi" | "sakura"

export interface DayEntry {
  date: string
  count: number
  members: string[]
}

export interface YearData {
  count: number
  days: DayEntry[]
}

export interface ScheduleEventEntry {
  date: string
  category?: string
  title: string
  member_uids: string[]
  time_start?: string
  time_end?: string
  id?: string
  url?: string
}

export interface ScheduleYearData {
  count: number
  events: ScheduleEventEntry[]
}
