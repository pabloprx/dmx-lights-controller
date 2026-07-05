// Tests for app/lib/clipMath.ts (mirrors useClipDrag.ts geometry/overlap/bounds).

import { describe, it, expect } from 'vitest'
import { getClipCursor, canPlaceClip, computeClipBounds, cellIndexToBeat, beatToCellIndex, snapBeatToSubdivision, type ClipLike } from '~/lib/clipMath'

describe('getClipCursor', () => {
  const width = 100

  it('returns resize-start within the left edge zone (< 8px)', () => {
    expect(getClipCursor(0, width)).toBe('resize-start')
    expect(getClipCursor(7, width)).toBe('resize-start')
  })

  it('returns resize-end within the right edge zone (> width - 8px)', () => {
    expect(getClipCursor(99, width)).toBe('resize-end')
    expect(getClipCursor(93, width)).toBe('resize-end')
  })

  it('returns move in the central body', () => {
    expect(getClipCursor(8, width)).toBe('move')
    expect(getClipCursor(50, width)).toBe('move')
    expect(getClipCursor(92, width)).toBe('move')
  })
})

describe('canPlaceClip', () => {
  const clips: ClipLike[] = [
    { id: 'a', trackId: 't1', startBeat: 1, duration: 4 }, // occupies beats 1..4
    { id: 'b', trackId: 't1', startBeat: 6, duration: 2 }, // occupies beats 6..7
  ]
  const setLength = 8

  it('rejects placements outside bounds', () => {
    expect(canPlaceClip('t1', 0, 2, clips, setLength)).toBe(false) // startBeat < 1
    expect(canPlaceClip('t1', 8, 2, clips, setLength)).toBe(false) // end 9 > 8
  })

  it('accepts a placement in a free gap on the same track', () => {
    // beat 5 alone is free (between 1..4 and 6..7)
    expect(canPlaceClip('t1', 5, 1, [...clips], setLength)).toBe(true)
  })

  it('rejects an overlapping placement', () => {
    // beats 3..4 overlap clip a
    expect(canPlaceClip('t1', 3, 2, clips, setLength)).toBe(false)
    // beat 7 overlaps clip b
    expect(canPlaceClip('t1', 7, 1, clips, setLength)).toBe(false)
  })

  it('ignores clips on other tracks', () => {
    // same beats as clip a, but a different track -> allowed
    expect(canPlaceClip('t2', 1, 4, clips, setLength)).toBe(true)
  })

  it('ignores the excluded clip (e.g. when moving it)', () => {
    // placing onto clip a's own footprint is fine if a is excluded
    expect(canPlaceClip('t1', 1, 4, clips, setLength, 'a')).toBe(true)
  })

  it('treats adjacency (touching ends) as non-overlapping', () => {
    // clip a ends at 4; placing at beat 5 should be allowed (newEnd 5 < next start 6 too)
    expect(canPlaceClip('t1', 5, 1, clips, setLength)).toBe(true)
  })
})

describe('computeClipBounds', () => {
  const setLength = 8

  it('move shifts start and clamps to >= 1', () => {
    expect(computeClipBounds('move', 2, 3, 2, setLength)).toEqual({ startBeat: 5, duration: 2 })
    // clamp to 1 when dragging far left
    expect(computeClipBounds('move', -10, 3, 2, setLength)).toEqual({ startBeat: 1, duration: 2 })
  })

  it('move clamps start so the clip stays within set length', () => {
    // duration 4 -> maxStart = 8 - 4 + 1 = 5
    expect(computeClipBounds('move', 100, 2, 4, setLength)).toEqual({ startBeat: 5, duration: 4 })
  })

  it('resize-start grows duration leftward (negative delta)', () => {
    // start 4, duration 2, delta -2 -> start 2, duration 4
    expect(computeClipBounds('resize-start', -2, 4, 2, setLength)).toEqual({ startBeat: 2, duration: 4 })
  })

  it('resize-start cannot shrink below 1 beat (delta capped by maxDelta)', () => {
    // originalDuration 3 -> maxDelta 2 ; delta 10 capped to 2 -> start 4, duration 1
    expect(computeClipBounds('resize-start', 10, 2, 3, setLength)).toEqual({ startBeat: 4, duration: 1 })
  })

  it('resize-start makes no change when the new start would go below 1', () => {
    // start 2, delta -5 -> actualDelta -5, start would be -3 -> rejected, unchanged
    expect(computeClipBounds('resize-start', -5, 2, 3, setLength)).toEqual({ startBeat: 2, duration: 3 })
  })

  it('resize-end grows duration and clamps to set length', () => {
    // start 2, duration 2, delta 2 -> duration 4
    expect(computeClipBounds('resize-end', 2, 2, 2, setLength)).toEqual({ startBeat: 2, duration: 4 })
    // maxDuration = 8 - 2 + 1 = 7
    expect(computeClipBounds('resize-end', 100, 2, 2, setLength)).toEqual({ startBeat: 2, duration: 7 })
  })

  it('resize-end cannot shrink below 1 beat', () => {
    expect(computeClipBounds('resize-end', -100, 2, 3, setLength)).toEqual({ startBeat: 2, duration: 1 })
  })
})

describe('sub-beat cell helpers', () => {
  it('cellIndexToBeat maps grid cells to 1-indexed fractional beats', () => {
    expect(cellIndexToBeat(0, 1)).toBe(1)
    expect(cellIndexToBeat(3, 1)).toBe(4)
    expect(cellIndexToBeat(0, 2)).toBe(1)
    expect(cellIndexToBeat(1, 2)).toBe(1.5) // second half of beat 1
    expect(cellIndexToBeat(2, 2)).toBe(2)
  })

  it('beatToCellIndex inverts cellIndexToBeat', () => {
    expect(beatToCellIndex(1, 2)).toBe(0)
    expect(beatToCellIndex(1.5, 2)).toBe(1)
    expect(beatToCellIndex(4, 1)).toBe(3)
  })

  it('snapBeatToSubdivision snaps to the nearest grid step', () => {
    expect(snapBeatToSubdivision(1.2, 2)).toBe(1)
    expect(snapBeatToSubdivision(1.4, 2)).toBe(1.5)
    expect(snapBeatToSubdivision(1.3, 1)).toBe(1)
  })
})

describe('canPlaceClip - fractional (sub-beat) clips', () => {
  const clips: ClipLike[] = [
    { id: 'a', trackId: 't1', startBeat: 1, duration: 0.5 },   // [1, 1.5)
    { id: 'b', trackId: 't1', startBeat: 1.5, duration: 0.5 }, // [1.5, 2)
  ]
  it('allows a half-beat clip in the adjacent half', () => {
    expect(canPlaceClip('t1', 2, 0.5, clips, 8)).toBe(true)
  })
  it('rejects a half-beat clip overlapping an existing one', () => {
    expect(canPlaceClip('t1', 1.5, 0.5, clips, 8)).toBe(false)
  })
  it('treats touching half-beat ends as non-overlapping', () => {
    // [1,1.5) and [1.5,2) touch but do not overlap -> both already coexist
    expect(canPlaceClip('t1', 1, 0.5, clips, 8, 'a')).toBe(true)
  })
})
