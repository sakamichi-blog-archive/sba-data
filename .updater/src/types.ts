export interface DayEntry {
  date: string
  count: number
  members: string[]
}

export interface YearData {
  count: number
  days: DayEntry[]
}
