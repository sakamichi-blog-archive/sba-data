import {
  hinataMembers,
  nogiMembers,
  sakuraMembers,
  type Member
} from "@sakamichi-blog-archive/utils/members"

import type { Group } from "./types.js"

function buildNameMap(members: Member[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of members) {
    map.set(m.name, m.uid)
    map.set(m.nameSpaced, m.uid)
  }
  return map
}

export const nameToUid: Record<Group, Map<string, string>> = {
  hinata: buildNameMap(hinataMembers),
  nogi: buildNameMap(nogiMembers),
  sakura: buildNameMap(sakuraMembers)
}
