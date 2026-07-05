// Pure helpers for Set section tags (filtering/grouping in the Perform view).
// Structural typing only ({ tags?: string[] }) so it stays testable and avoids
// the name clash with the DMX `Set` type.

export function collectSetTags(sets: { tags?: string[] }[]): string[] {
  const out: string[] = []
  for (const s of sets) {
    for (const t of s.tags ?? []) {
      if (!out.includes(t)) out.push(t)
    }
  }
  return out
}

export function filterSetsByTag<T extends { tags?: string[] }>(sets: T[], tag: string | null): T[] {
  if (!tag) return sets
  return sets.filter(s => (s.tags ?? []).includes(tag))
}

// Order tags by a canonical list first (Intro, Buildup, Drop, FX...), with any
// extra/custom tags appended in first-seen order. Used for predictable
// up/down section cycling in Perform regardless of set creation order.
export function orderSectionTags(tags: string[], canonical: readonly string[]): string[] {
  const inCanon = canonical.filter(t => tags.includes(t))
  const extras = tags.filter(t => !canonical.includes(t))
  return [...inCanon, ...extras]
}

// One bucket per tag (in first-seen order), plus a trailing "Untagged" bucket.
export function groupSetsByTag<T extends { tags?: string[] }>(sets: T[]): { tag: string; sets: T[] }[] {
  const groups = collectSetTags(sets).map(tag => ({
    tag,
    sets: sets.filter(s => (s.tags ?? []).includes(tag)),
  }))
  const untagged = sets.filter(s => (s.tags ?? []).length === 0)
  if (untagged.length) groups.push({ tag: 'Untagged', sets: untagged })
  return groups
}
