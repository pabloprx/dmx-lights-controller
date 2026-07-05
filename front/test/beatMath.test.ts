// Tests for app/lib/beatMath.ts (mirrors useSetPlayer.ts beatInSet).

import { describe, it, expect } from 'vitest'
import { computeBeatInSet, clampSubdivision, computeStepInSet, mirrorBeat, mirrorStep, reverseFromEnd, nextBeatBoundary, wrapPos, armReverseHere, releaseReverseHere, sampleReverseHere, type BeatInSetParams } from '~/lib/beatMath'

function params(overrides: Partial<BeatInSetParams> = {}): BeatInSetParams {
  return {
    linkConnected: false,
    barNumber: 0,
    beatInBar: 0,
    quantum: 4,
    currentBeat: 1,
    setLength: 8,
    loopEnabled: true,
    ...overrides,
  }
}

describe('computeBeatInSet - Link (bar-aware) mode', () => {
  it('combines bar within set and beat in bar for a multi-bar set', () => {
    // setLength 8, quantum 4 -> barsInSet 2.
    // bar 0, beat 2 -> 0*4 + 2 = 2
    expect(computeBeatInSet(params({ linkConnected: true, barNumber: 0, beatInBar: 2, quantum: 4, setLength: 8 }))).toBe(2)
    // bar 1, beat 3 -> 1*4 + 3 = 7
    expect(computeBeatInSet(params({ linkConnected: true, barNumber: 1, beatInBar: 3, quantum: 4, setLength: 8 }))).toBe(7)
  })

  it('wraps the bar index across the set (barNumber % barsInSet)', () => {
    // barsInSet = 2; barNumber 2 wraps to bar 0 -> 0*4 + 1 = 1
    expect(computeBeatInSet(params({ linkConnected: true, barNumber: 2, beatInBar: 1, quantum: 4, setLength: 8 }))).toBe(1)
    // barNumber 3 wraps to bar 1 -> 1*4 + 0 = 4
    expect(computeBeatInSet(params({ linkConnected: true, barNumber: 3, beatInBar: 0, quantum: 4, setLength: 8 }))).toBe(4)
  })

  it('clamps to set length when the set is not divisible by quantum', () => {
    // setLength 6, quantum 4 -> barsInSet = ceil(6/4) = 2.
    // bar 1, beat 4 -> 1*4 + 4 = 8, clamped to 6
    expect(computeBeatInSet(params({ linkConnected: true, barNumber: 1, beatInBar: 4, quantum: 4, setLength: 6 }))).toBe(6)
  })
})

describe('computeBeatInSet - internal tempo mode', () => {
  it('loops with modulo when loopEnabled', () => {
    // setLength 4: beats 1,2,3,4,1,2,...
    expect(computeBeatInSet(params({ currentBeat: 1, setLength: 4, loopEnabled: true }))).toBe(1)
    expect(computeBeatInSet(params({ currentBeat: 4, setLength: 4, loopEnabled: true }))).toBe(4)
    expect(computeBeatInSet(params({ currentBeat: 5, setLength: 4, loopEnabled: true }))).toBe(1)
    expect(computeBeatInSet(params({ currentBeat: 6, setLength: 4, loopEnabled: true }))).toBe(2)
    expect(computeBeatInSet(params({ currentBeat: 9, setLength: 4, loopEnabled: true }))).toBe(1)
  })

  it('clamps to set length when loop is off', () => {
    expect(computeBeatInSet(params({ currentBeat: 3, setLength: 4, loopEnabled: false }))).toBe(3)
    expect(computeBeatInSet(params({ currentBeat: 4, setLength: 4, loopEnabled: false }))).toBe(4)
    expect(computeBeatInSet(params({ currentBeat: 99, setLength: 4, loopEnabled: false }))).toBe(4)
  })
})

describe('clampSubdivision', () => {
  it('defaults missing/invalid to 1', () => {
    expect(clampSubdivision(8, undefined)).toBe(1)
    expect(clampSubdivision(8, 0)).toBe(1)
    expect(clampSubdivision(8, 1)).toBe(1)
  })

  it('allows 2x and 4x when cells stay within the 32 cap', () => {
    expect(clampSubdivision(8, 2)).toBe(2)   // 16 cells
    expect(clampSubdivision(8, 4)).toBe(4)   // 32 cells (at cap)
    expect(clampSubdivision(16, 2)).toBe(2)  // 32 cells (at cap)
    expect(clampSubdivision(4, 4)).toBe(4)   // 16 cells
  })

  it('snaps to the nearest allowed value (1/2/4)', () => {
    expect(clampSubdivision(8, 3)).toBe(2)   // 3 -> 2
    expect(clampSubdivision(4, 8)).toBe(4)   // 8 -> 4 (largest allowed)
  })

  it('steps down to fit the 32-cell cap', () => {
    expect(clampSubdivision(16, 4)).toBe(2)  // 64 -> 32 (2x)
    expect(clampSubdivision(32, 2)).toBe(1)  // 64 -> 1x
    expect(clampSubdivision(32, 4)).toBe(1)  // 128 -> 1x
  })
})

describe('computeStepInSet', () => {
  function sp(overrides = {}) {
    return { linkConnected: false, linkPhase: 0, internalBeatFloat: 0, beatInSet: 1, subdivision: 1, ...overrides }
  }

  it('returns the integer beat when subdivision is 1 (backward compatible)', () => {
    expect(computeStepInSet(sp({ beatInSet: 3, internalBeatFloat: 2.7 }))).toBe(3)
  })

  it('internal mode: quantizes the intra-beat fraction to half-beats at 2x', () => {
    // first half of beat 1
    expect(computeStepInSet(sp({ beatInSet: 1, subdivision: 2, internalBeatFloat: 0.2 }))).toBe(1)
    // second half of beat 1
    expect(computeStepInSet(sp({ beatInSet: 1, subdivision: 2, internalBeatFloat: 0.6 }))).toBe(1.5)
    // second half of beat 3
    expect(computeStepInSet(sp({ beatInSet: 3, subdivision: 2, internalBeatFloat: 8.9 }))).toBe(3.5)
  })

  it('link mode: uses bar-phase %1 for the intra-beat fraction', () => {
    // phase 2.6 -> intra-beat 0.6 -> second half
    expect(computeStepInSet(sp({ linkConnected: true, beatInSet: 2, subdivision: 2, linkPhase: 2.6 }))).toBe(2.5)
    expect(computeStepInSet(sp({ linkConnected: true, beatInSet: 2, subdivision: 2, linkPhase: 2.1 }))).toBe(2)
  })
})

describe('reverse playback mirrors', () => {
  it('mirrorBeat swaps first and last beats', () => {
    expect(mirrorBeat(1, 8)).toBe(8)
    expect(mirrorBeat(8, 8)).toBe(1)
    expect(mirrorBeat(3, 8)).toBe(6)
    // odd length: middle maps to itself
    expect(mirrorBeat(2, 3)).toBe(2)
  })

  it('mirrorBeat is an involution (mirror twice = identity)', () => {
    for (let b = 1; b <= 8; b++) expect(mirrorBeat(mirrorBeat(b, 8), 8)).toBe(b)
  })

  it('mirrorStep swaps the first and last quarter steps', () => {
    expect(mirrorStep(1, 8, 4)).toBe(8.75)
    expect(mirrorStep(8.75, 8, 4)).toBe(1)
    expect(mirrorStep(4.5, 8, 4)).toBe(5.25)
  })

  it('mirrorStep is an involution across the whole grid', () => {
    for (let i = 0; i < 32; i++) {
      const step = 1 + i / 4
      expect(mirrorStep(mirrorStep(step, 8, 4), 8, 4)).toBeCloseTo(step, 9)
    }
  })

  it('floor(mirrorStep(x)) equals mirrorBeat(floor(x)) - display stays consistent', () => {
    for (let i = 0; i < 32; i++) {
      const step = 1 + i / 4
      expect(Math.floor(mirrorStep(step, 8, 4))).toBe(mirrorBeat(Math.floor(step), 8))
    }
  })

  it('consecutive forward steps map to consecutive backward steps', () => {
    // forward 1 -> 1.25 must sample 8.75 -> 8.5 (true reverse, no jumps)
    expect(mirrorStep(1.25, 8, 4)).toBe(8.5)
    expect(mirrorStep(1.5, 8, 4)).toBe(8.25)
  })
})

describe('reverseFromEnd (anchored "restart reversed")', () => {
  it('starts at the LAST step at press time, wherever the clock is', () => {
    expect(reverseFromEnd(3.5, 3.5, 8, 4)).toBe(8.75)
    expect(reverseFromEnd(1, 1, 8, 4)).toBe(8.75)
    expect(reverseFromEnd(8.75, 8.75, 8, 4)).toBe(8.75)
  })

  it('walks backward one grid step per forward grid step', () => {
    expect(reverseFromEnd(3.75, 3.5, 8, 4)).toBe(8.5)
    expect(reverseFromEnd(4.0, 3.5, 8, 4)).toBe(8.25)
    expect(reverseFromEnd(4.25, 3.5, 8, 4)).toBe(8)
  })

  it('reaches step 1 after length - 1/4 elapsed, then loops back to the end', () => {
    // elapsed 7.75 beats -> position 1
    expect(reverseFromEnd(3.25 + 8, 3.5 + 8, 8, 4)).toBeCloseTo(1, 9)
    // elapsed 8 wraps to 0 -> back at the last step
    expect(reverseFromEnd(3.5, 3.5 + 0, 8, 4)).toBe(8.75)
  })

  it('handles the forward clock wrapping past the set end', () => {
    // anchor late in the set, forward wrapped to the next loop
    // elapsed = (1.25 - 8.5) mod 8 = 0.75 -> 8.75 - 0.75 = 8
    expect(reverseFromEnd(1.25, 8.5, 8, 4)).toBe(8)
  })

  it('always lands inside [1, length+1)', () => {
    for (let i = 0; i < 64; i++) {
      const fwd = 1 + (i % 32) / 4
      const anchor = 1 + ((i * 3) % 32) / 4
      const pos = reverseFromEnd(fwd, anchor, 8, 4)
      expect(pos).toBeGreaterThanOrEqual(1)
      expect(pos).toBeLessThan(9)
    }
  })
})

describe('reverseFromHere (variant C: from current position, beat-quantized edges)', () => {
  it('nextBeatBoundary: mid-beat goes to next, exactly-on-beat stays', () => {
    expect(nextBeatBoundary(2.25)).toBe(3)
    expect(nextBeatBoundary(2.75)).toBe(3)
    expect(nextBeatBoundary(3)).toBe(3)
    // float dust from the quarter grid must not push a whole beat forward
    expect(nextBeatBoundary(3 + 1e-12)).toBe(3)
  })

  it('arm projects the engage position to the boundary', () => {
    // clock 10.5, forward position 2.5 in an 8-beat set -> engages at 11 on position 3
    const st = armReverseHere(10.5, 2.5, 8)
    expect(st.engageAbs).toBe(11)
    expect(st.engagePos).toBe(3)
  })

  it('stays forward until the engage beat, then is seamless at the boundary', () => {
    const st = armReverseHere(10.5, 2.5, 8)
    // before the boundary: forward
    expect(sampleReverseHere(st, 10.75, 2.75, 8)).toEqual({ pos: 2.75, reversed: false })
    // at the boundary: reversed pos equals the forward pos (no jump)
    expect(sampleReverseHere(st, 11, 3, 8)).toEqual({ pos: 3, reversed: true })
  })

  it('walks backward from the current position: 3 -> 2 -> 1 -> 8 -> 7', () => {
    const st = armReverseHere(11, 3, 8) // engage right now at beat 3
    expect(sampleReverseHere(st, 11, 3, 8).pos).toBe(3)
    expect(sampleReverseHere(st, 11.25, 3.25, 8).pos).toBe(2.75)
    expect(sampleReverseHere(st, 12, 4, 8).pos).toBe(2)
    expect(sampleReverseHere(st, 13, 5, 8).pos).toBe(1)
    expect(sampleReverseHere(st, 13.25, 5.25, 8).pos).toBe(8.75) // wrap below 1
    expect(sampleReverseHere(st, 14, 6, 8).pos).toBe(8)
    expect(sampleReverseHere(st, 15, 7, 8).pos).toBe(7)
  })

  it('release resumes forward at the NEXT whole beat, not at the click', () => {
    let st = armReverseHere(11, 3, 8)
    st = releaseReverseHere(st, 12.5) // released mid-beat
    // still reversed until the boundary
    expect(sampleReverseHere(st, 12.75, 4.75, 8).reversed).toBe(true)
    // at the boundary: forward synced position again
    expect(sampleReverseHere(st, 13, 5, 8)).toEqual({ pos: 5, reversed: false })
  })

  it('a tap shorter than the arm window is a clean no-op (never mid-beat)', () => {
    let st = armReverseHere(10.5, 2.5, 8) // engages at 11
    st = releaseReverseHere(st, 10.75)    // released before it ever engaged
    expect(st.disengageAbs).toBe(11)      // clamped to engageAbs
    expect(sampleReverseHere(st, 11, 3, 8).reversed).toBe(false)
    expect(sampleReverseHere(st, 11.5, 3.5, 8).reversed).toBe(false)
  })

  it('wrapPos wraps into [1, length+1)', () => {
    expect(wrapPos(0.75, 8)).toBe(8.75)
    expect(wrapPos(9, 8)).toBe(1)
    expect(wrapPos(-4, 8)).toBe(4)
    expect(wrapPos(3, 8)).toBe(3)
  })
})
