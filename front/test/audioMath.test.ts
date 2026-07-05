// Tests for app/lib/audioMath.ts (mirrors useAudioReactive.ts pure helpers).

import { describe, it, expect } from 'vitest'
import { applyCurve, percentToDMX } from '~/lib/audioMath'

describe('applyCurve', () => {
  it('square is a 0/1 step gated at value > 0', () => {
    expect(applyCurve(0, 'square')).toBe(0)
    expect(applyCurve(0.0001, 'square')).toBe(1)
    expect(applyCurve(0.5, 'square')).toBe(1)
    expect(applyCurve(1, 'square')).toBe(1)
  })

  it('linear is the identity', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      expect(applyCurve(v, 'linear')).toBe(v)
    }
  })

  it('sine maps endpoints 0 -> 0, 1 -> 1, midpoint 0.5 -> ~0.5', () => {
    expect(applyCurve(0, 'sine')).toBeCloseTo(0, 6)
    expect(applyCurve(1, 'sine')).toBeCloseTo(1, 6)
    expect(applyCurve(0.5, 'sine')).toBeCloseTo(0.5, 6)
  })

  it('sine is monotonically increasing over 0..1', () => {
    let prev = -Infinity
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const out = applyCurve(v, 'sine')
      expect(out).toBeGreaterThanOrEqual(prev)
      prev = out
    }
  })
})

describe('percentToDMX', () => {
  it('dimmer channel (offset 0) maps 0% -> 9 and 100% -> 134', () => {
    expect(percentToDMX(0, 0)).toBe(9)
    expect(percentToDMX(100, 0)).toBe(134)
  })

  it('dimmer channel midpoint 50% lands inside the 9-134 band', () => {
    const mid = percentToDMX(50, 0)
    expect(mid).toBeGreaterThan(9)
    expect(mid).toBeLessThan(134)
    expect(mid).toBe(Math.round(9 + 0.5 * 125))
  })

  it('color channels (offset != 0) map 0% -> 0 and 100% -> 255', () => {
    expect(percentToDMX(0, 1)).toBe(0)
    expect(percentToDMX(100, 1)).toBe(255)
    expect(percentToDMX(50, 4)).toBe(Math.round(0.5 * 255))
  })
})
