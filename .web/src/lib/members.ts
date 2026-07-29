import {
  hinataMembers,
  keyakiMembers,
  nogiMembers,
  sakuraMembers,
  type Generation,
  type Member
} from "@sakamichi-blog-archive/utils/members"

const membersByGroup: Record<string, Member[]> = {
  hinata: hinataMembers,
  keyaki: keyakiMembers,
  nogi: nogiMembers,
  sakura: sakuraMembers
}

export function getMembers(group: string): Member[] {
  return membersByGroup[group] ?? []
}

export interface MemberGeneration {
  generation: Generation
  members: Member[]
}

export function getGenerations(group: string): MemberGeneration[] {
  const generations: MemberGeneration[] = []

  for (const member of getMembers(group)) {
    const generation = member.generation
    if (generation === undefined) {
      continue
    }

    let entry = generations.find(g => g.generation.key === generation.key)
    if (entry === undefined) {
      entry = { generation, members: [] }
      generations.push(entry)
    }
    entry.members.push(member)
  }

  return generations.toSorted((a, b) => a.generation.seq - b.generation.seq)
}
