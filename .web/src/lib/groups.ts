interface Group {
  englishShort: string
  key: string
}

export const groups: Group[] = [
  { englishShort: "Nogi", key: "nogi" },
  { englishShort: "Keyaki", key: "keyaki" },
  { englishShort: "Hinata", key: "hinata" },
  { englishShort: "Sakura", key: "sakura" }
]

export function getGroup(key: string): Group | undefined {
  return groups.find(group => group.key === key)
}
