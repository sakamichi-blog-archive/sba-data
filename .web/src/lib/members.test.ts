import { describe, expect, it } from "vitest"

import { groups } from "./groups.js"
import { getGenerations } from "./members.js"

describe("getGenerations", () => {
  // The member filter renders nameEnglish as the option label, so every member that reaches it
  // needs one. utils leaves nameEnglish undefined for group blog accounts, which only stay out of
  // the filter because they have no generation.
  it.each(groups.map(group => group.key))("gives every %s member a nameEnglish", group => {
    const members = getGenerations(group).flatMap(generation => generation.members)

    expect(members.length).toBeGreaterThan(0)
    expect(members.filter(member => !member.nameEnglish).map(member => member.name)).toEqual([])
  })
})
