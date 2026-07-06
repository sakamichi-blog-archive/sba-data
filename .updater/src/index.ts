import { updateGroup } from './update.js'

await Promise.all([
  updateGroup('hinata'),
  updateGroup('nogi'),
  updateGroup('sakura'),
])
