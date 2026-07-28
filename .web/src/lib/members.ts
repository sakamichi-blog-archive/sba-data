import {
  hinataMembers,
  keyakiMembers,
  nogiMembers,
  sakuraMembers,
  type Generation,
  type Member
} from "@sakamichi-blog-archive/utils/members"

export type { Member }

const membersByGroup: Record<string, Member[]> = {
  hinata: hinataMembers,
  keyaki: keyakiMembers,
  nogi: nogiMembers,
  sakura: sakuraMembers
}

export function getMembers(group: string): Member[] {
  return membersByGroup[group] ?? []
}

export function getMember(group: string, uid: string): Member | undefined {
  return getMembers(group).find(member => member.uid === uid)
}

export interface MemberGeneration {
  generation: Generation
  members: Member[]
}

export function getGenerations(group: string): MemberGeneration[] {
  const generations: MemberGeneration[] = []

  for (const member of getMembers(group)) {
    if (member.generation === undefined) {
      continue
    }

    let entry = generations.find(g => g.generation.key === member.generation!.key)
    if (entry === undefined) {
      entry = { generation: member.generation, members: [] }
      generations.push(entry)
    }
    entry.members.push(member)
  }

  return generations.sort((a, b) => a.generation.seq - b.generation.seq)
}
