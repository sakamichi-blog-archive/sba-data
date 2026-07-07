import { updateGroup } from './update.js'

const date = process.argv[2]

if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Invalid date: ${date}. Expected YYYY-MM-DD.`)
  process.exit(1)
}

await Promise.all([
  updateGroup('hinata', date),
  updateGroup('nogi', date),
  updateGroup('sakura', date),
])
