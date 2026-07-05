// Tests for app/lib/setTagMath.ts

import { describe, it, expect } from 'vitest'
import { collectSetTags, filterSetsByTag, groupSetsByTag, orderSectionTags } from '~/lib/setTagMath'

const sets = [
  { id: 'a', tags: ['Drop', 'Buildup'] },
  { id: 'b', tags: ['Drop'] },
  { id: 'c', tags: [] },
  { id: 'd' }, // no tags field
]

describe('collectSetTags', () => {
  it('returns unique tags in first-seen order', () => {
    expect(collectSetTags(sets)).toEqual(['Drop', 'Buildup'])
  })
  it('handles empty input', () => {
    expect(collectSetTags([])).toEqual([])
  })
})

describe('filterSetsByTag', () => {
  it('null returns everything', () => {
    expect(filterSetsByTag(sets, null)).toHaveLength(4)
  })
  it('filters to sets carrying the tag', () => {
    expect(filterSetsByTag(sets, 'Drop').map(s => s.id)).toEqual(['a', 'b'])
    expect(filterSetsByTag(sets, 'Buildup').map(s => s.id)).toEqual(['a'])
  })
  it('treats a missing tags field as no tags', () => {
    expect(filterSetsByTag(sets, 'Nope')).toEqual([])
  })
})

describe('orderSectionTags', () => {
  const canon = ['Intro', 'Buildup', 'Drop', 'FX']
  it('orders by the canonical list regardless of input order', () => {
    expect(orderSectionTags(['Drop', 'Intro', 'FX', 'Buildup'], canon))
      .toEqual(['Intro', 'Buildup', 'Drop', 'FX'])
  })
  it('appends custom tags after canonical ones (first-seen order)', () => {
    expect(orderSectionTags(['MyTag', 'Drop', 'Other'], canon))
      .toEqual(['Drop', 'MyTag', 'Other'])
  })
  it('drops canonical tags that are not present', () => {
    expect(orderSectionTags(['FX'], canon)).toEqual(['FX'])
  })
})

describe('groupSetsByTag', () => {
  it('one bucket per tag plus a trailing Untagged bucket', () => {
    const g = groupSetsByTag(sets)
    expect(g.map(x => x.tag)).toEqual(['Drop', 'Buildup', 'Untagged'])
    expect(g[0]!.sets.map(s => s.id)).toEqual(['a', 'b'])
    expect(g[2]!.sets.map(s => s.id)).toEqual(['c', 'd'])
  })
  it('omits the Untagged bucket when all sets are tagged', () => {
    const g = groupSetsByTag([{ id: 'x', tags: ['Mid'] }])
    expect(g.map(x => x.tag)).toEqual(['Mid'])
  })
})
