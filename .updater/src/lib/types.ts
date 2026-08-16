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
  // The site's stable category key (e.g. "media") and the label it displays (e.g. "テレビ"). Both
  // are kept: the key survives relabelling and is what logic should branch on, but it's coarser
  // than the label for hinata/sakura, where one "media" key covers テレビ/ラジオ/雑誌/写真集/...
  category_key?: string
  category_name?: string
  title: string
  member_uids: string[]
  time_start?: string
  time_end?: string
  id?: string
}

export interface ScheduleYearData {
  count: number
  events: ScheduleEventEntry[]
}
