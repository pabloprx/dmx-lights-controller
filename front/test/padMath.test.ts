// Tests for app/lib/padMath.ts (FX pad launch/release/overlay rules).

import { describe, it, expect } from 'vitest'
import {
  resolveLaunchStep, padLocalStep, resolveReleaseStep,
  buildActivePad, padAudible, padFinished, overlayFrame,
  LATE_GRACE,
} from '~/lib/padMath'

describe('resolveLaunchStep', () => {
  it('joins the boundary exactly on it', () => {
    expect(resolveLaunchStep(4.0, 1)).toBe(4.0)
    expect(resolveLaunchStep(8.0, 4)).toBe(8.0)
    expect(resolveLaunchStep(0, 1)).toBe(0)
  })

  it('late-press grace: strictly inside the first quarter joins the missed boundary', () => {
    // stepped clock reads 4.0 for the whole first quarter-beat window
    expect(resolveLaunchStep(4.0 + LATE_GRACE / 2, 1)).toBe(4.0)
    // exactly one playback step late is NOT grace (strict <) -> next beat
    expect(resolveLaunchStep(4.25, 1)).toBe(5.0)
    expect(resolveLaunchStep(4.7, 1)).toBe(5.0)
  })

  it('quantize 4: schedules the next 4-beat boundary', () => {
    expect(resolveLaunchStep(5.0, 4)).toBe(8.0)
    expect(resolveLaunchStep(6.75, 4)).toBe(8.0)
    expect(resolveLaunchStep(4.1, 4)).toBe(4.0) // grace still one quarter-BEAT, not a quarter-quantum
  })

  it('quantize 2', () => {
    expect(resolveLaunchStep(1.0, 2)).toBe(2.0)
    expect(resolveLaunchStep(2.0, 2)).toBe(2.0)
    expect(resolveLaunchStep(2.5, 2)).toBe(4.0)
  })
})

describe('padLocalStep', () => {
  it('is 0 (not launched) before the anchor', () => {
    expect(padLocalStep(1.5, 2.0, 2)).toBe(0)
  })

  it('is 1-indexed from the anchor', () => {
    expect(padLocalStep(2.0, 2.0, 2)).toBe(1)
    expect(padLocalStep(2.75, 2.0, 2)).toBe(1.75)
  })

  it('wraps mod the pad length (loop while held)', () => {
    expect(padLocalStep(4.0, 2.0, 2)).toBe(1)   // 2 beats later -> back to step 1
    expect(padLocalStep(5.5, 2.0, 2)).toBe(2.5) // rel 3.5 % 2 = 1.5 -> 2.5
  })

  it("'length' phase-lock (anchor 0) samples the global position", () => {
    expect(padLocalStep(9.25, 0, 8)).toBe(2.25) // 9.25 % 8 = 1.25 -> step 2.25
  })
})

describe('resolveReleaseStep', () => {
  it('instant tap still plays min-hold, snapped to the release grid', () => {
    // pressed+released at 2.0, min 1 beat, release grid 1/2 -> stops at 3.0
    expect(resolveReleaseStep(2.0, 2.0, 0.5, 1)).toBe(3.0)
  })

  it('long hold releases on the next grid line after the release', () => {
    expect(resolveReleaseStep(7.3, 2.0, 0.5, 1)).toBe(7.5)
    expect(resolveReleaseStep(7.3, 2.0, 0.25, 1)).toBe(7.5)
    expect(resolveReleaseStep(7.3, 2.0, 1, 1)).toBe(8.0)
  })

  it('release exactly on a grid line stays there', () => {
    expect(resolveReleaseStep(7.5, 2.0, 0.5, 1)).toBe(7.5)
  })

  it('released BEFORE the scheduled launch: still fires and plays min-hold', () => {
    // pressed at 1.7 -> launch 2.0; released at 1.9 -> plays 2.0..3.0
    expect(resolveReleaseStep(1.9, 2.0, 0.5, 1)).toBe(3.0)
  })
})

describe('buildActivePad', () => {
  it('numeric quantize: anchor = visibleFrom = the launch boundary', () => {
    const pad = buildActivePad({ setId: 's1', quantize: 4, releaseQuantize: 0.5, minHoldBeats: 1 }, 5.0)
    expect(pad.anchorStep).toBe(8.0)
    expect(pad.visibleFrom).toBe(8.0)
    expect(pad.releaseAt).toBeNull()
  })

  it("'length': anchored to the global downbeat, appears on the next beat", () => {
    const pad = buildActivePad({ setId: 's1', quantize: 'length', releaseQuantize: 0.5, minHoldBeats: 1 }, 5.5)
    expect(pad.anchorStep).toBe(0)
    expect(pad.visibleFrom).toBe(6.0)
  })
})

describe('padAudible / padFinished', () => {
  const pad = { setId: 's1', anchorStep: 2.0, visibleFrom: 2.0, releaseAt: 3.0 }

  it('audible between visibleFrom and releaseAt', () => {
    expect(padAudible(pad, 1.75)).toBe(false) // not launched
    expect(padAudible(pad, 2.0)).toBe(true)
    expect(padAudible(pad, 2.75)).toBe(true)
  })

  it('finished at the release step', () => {
    expect(padFinished(pad, 2.75)).toBe(false)
    expect(padFinished(pad, 3.0)).toBe(true)
    expect(padAudible(pad, 3.0)).toBe(false)
  })

  it('held pad (releaseAt null) never finishes', () => {
    expect(padFinished({ ...pad, releaseAt: null }, 99)).toBe(false)
  })
})

describe('overlayFrame', () => {
  const base = [10, 20, 30, 40, 50, 60, 70, 80]

  it('replaces only the claimed spans, base shows through elsewhere', () => {
    const fx = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = overlayFrame(base, fx, [{ start: 2, count: 3 }])
    expect(out).toEqual([10, 20, 3, 4, 5, 60, 70, 80])
  })

  it('a painted-black clip overlays zeros (opaque), not transparent', () => {
    const fx = [0, 0, 0, 0, 0, 0, 0, 0]
    const out = overlayFrame(base, fx, [{ start: 0, count: 2 }])
    expect(out).toEqual([0, 0, 30, 40, 50, 60, 70, 80])
  })

  it('no spans -> base untouched', () => {
    expect(overlayFrame(base, [9, 9, 9, 9, 9, 9, 9, 9], [])).toEqual(base)
  })

  it('spans past the frame end are clipped safely', () => {
    const fx = new Array(8).fill(1)
    const out = overlayFrame(base, fx, [{ start: 6, count: 5 }])
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 1, 1])
  })

  it('later spans win (latest press on top)', () => {
    const fxA = new Array(8).fill(100)
    const withA = overlayFrame(base, fxA, [{ start: 0, count: 4 }])
    const fxB = new Array(8).fill(200)
    const withB = overlayFrame(withA, fxB, [{ start: 2, count: 4 }])
    expect(withB).toEqual([100, 100, 200, 200, 200, 200, 70, 80])
  })
})
