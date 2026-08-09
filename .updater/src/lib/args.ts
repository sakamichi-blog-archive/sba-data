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
//
// Every token is checked rather than picked out by search, so a near-miss like `--groups=nogi`
// fails loudly instead of silently falling back to archiving all three groups.
export function parseArchiveArgs(args: string[]): ArchiveArgs {
  let date: string | undefined
  let group: Group | undefined

  for (const arg of args) {
    if (arg.startsWith("--")) {
      if (!arg.startsWith("--group=")) {
        throw new Error(`Unknown option: ${arg}. Expected --group=<group>.`)
      }
      if (group !== undefined) throw new Error(`Repeated option: ${arg}.`)

      const value = arg.slice("--group=".length)
      if (!ALL_GROUPS.includes(value as Group)) {
        throw new Error(`Invalid group: ${value}. Expected one of ${ALL_GROUPS.join(", ")}.`)
      }
      group = value as Group
      continue
    }

    if (date !== undefined) throw new Error(`Unexpected argument: ${arg}.`)
    if (!isValidDate(arg)) throw new Error(`Invalid date: ${arg}. Expected YYYY-MM-DD.`)
    date = arg
  }

  return { date, groups: group === undefined ? ALL_GROUPS : [group] }
}
