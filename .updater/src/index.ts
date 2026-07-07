import { updateGroup } from './update.js'

const date = process.argv[2]

if (date !== undefined) {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    console.error(`Invalid date: ${date}. Expected YYYY-MM-DD.`)
    process.exit(1)
  }
}

await Promise.all([
  updateGroup('hinata', date),
  updateGroup('nogi', date),
  updateGroup('sakura', date),
])
