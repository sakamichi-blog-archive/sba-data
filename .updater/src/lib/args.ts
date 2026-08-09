import type { Group } from "./types.js"

export const ALL_GROUPS: Group[] = ["hinata", "nogi", "sakura"]

export interface ArchiveArgs {
  date?: string
  groups: Group[]
}

function isValidDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`)
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  )
}

// Parses `archive:blogs [date] [--group=<group>]`. Throws on bad input so the entrypoint can
// report it and exit — every other failure mode in this script is per-URL and non-fatal.
//
// Only the `--group=` form is accepted: with a space-separated value, `--group nogi` would be
// indistinguishable from the optional date positional whenever the date is omitted.
export function parseArchiveArgs(args: string[]): ArchiveArgs {
  const groupFlag = args.find(arg => arg.startsWith("--group="))
  const date = args.find(arg => !arg.startsWith("--"))

  if (date !== undefined && !isValidDate(date)) {
    throw new Error(`Invalid date: ${date}. Expected YYYY-MM-DD.`)
  }

  if (groupFlag === undefined) return { date, groups: ALL_GROUPS }

  const group = groupFlag.slice("--group=".length)
  if (!ALL_GROUPS.includes(group as Group)) {
    throw new Error(`Invalid group: ${group}. Expected one of ${ALL_GROUPS.join(", ")}.`)
  }

  return { date, groups: [group as Group] }
}
