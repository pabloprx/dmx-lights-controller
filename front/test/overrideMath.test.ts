// Tests for app/lib/overrideMath.ts (live performance override layer).

import { describe, it, expect } from 'vitest'
import {
  hueToRgb, lrBalanceGains, splitLeftRight, buildSlots,
  applyBalanceToFrame, applyTintToFrame, applyBlinderToFrame, applyBlackoutToFrame,
  type FixtureSlot,
} from '~/lib/overrideMath'

// Two RGBW pinspots at ch1 and ch6 -> idx 0 and 5.
const slots: FixtureSlot[] = [
  { idx: 0, rgbw: true, channelCount: 5, side: 'L' },
  { idx: 5, rgbw: true, channelCount: 5, side: 'R' },
]
function frame(): number[] { return new Array(100).fill(0) }

describe('hueToRgb', () => {
  it('maps the primaries', () => {
    expect(hueToRgb(0)).toEqual([255, 0, 0])
    expect(hueToRgb(1 / 3)).toEqual([0, 255, 0])
    expect(hueToRgb(2 / 3)).toEqual([0, 0, 255])
  })
  it('wraps hue around 1', () => {
    expect(hueToRgb(1)).toEqual([255, 0, 0])
  })
})

describe('lrBalanceGains', () => {
  it('center is even, extremes crossfade', () => {
    expect(lrBalanceGains(0.5)).toEqual({ left: 1, right: 1 }) // even: both full
    expect(lrBalanceGains(0)).toEqual({ left: 1, right: 0 })   // full left
    expect(lrBalanceGains(1)).toEqual({ left: 0, right: 1 })   // full right
  })
  it('center keeps both sides at full', () => {
    const g = lrBalanceGains(0.5)
    expect(g.left).toBe(1)
  })
})

describe('splitLeftRight', () => {
  it('splits first/second half (odd -> extra on left)', () => {
    expect(splitLeftRight([1, 2, 3, 4])).toEqual({ left: [1, 2], right: [3, 4] })
    expect(splitLeftRight([1, 2, 3])).toEqual({ left: [1, 2], right: [3] })
  })
})

describe('buildSlots', () => {
  it('assigns sides by index and reads rgbw/channelCount from profile', () => {
    const devices = [
      { startChannel: 1, profileId: 'p' },
      { startChannel: 6, profileId: 'p' },
    ]
    const out = buildSlots(devices, () => ({ controlType: 'rgbw', channelCount: 5 }))
    expect(out[0]).toEqual({ idx: 0, rgbw: true, channelCount: 5, side: 'L' })
    expect(out[1]).toEqual({ idx: 5, rgbw: true, channelCount: 5, side: 'R' })
  })
})

describe('applyBalanceToFrame', () => {
  it('dims a side by scaling its COLOUR channels (colour-independent), ch0 untouched', () => {
    const f = frame()
    f[0] = 134; f[1] = 255 // left device: dimmer + red
    f[5] = 134; f[6] = 255 // right device: dimmer + red
    const out = applyBalanceToFrame(f, slots, lrBalanceGains(1)) // value 1 -> {left:0, right:1}
    expect(out[6]).toBe(255) // right (gain 1) untouched
    expect(out[0]).toBe(134) // ch0 not scaled (balance acts on colour)
    expect(out[1]).toBe(0)   // left red scaled to 0 -> off
  })
  it('center leaves both untouched', () => {
    const f = frame(); f[1] = 200; f[6] = 200
    const out = applyBalanceToFrame(f, slots, lrBalanceGains(0.5))
    expect(out[1]).toBe(200)
    expect(out[6]).toBe(200)
  })
})

describe('applyTintToFrame', () => {
  it('washes the hue over lit fixtures AND lights up dark ones', () => {
    const f = frame()
    f[0] = 134; f[3] = 255; f[4] = 100 // device0 lit blue + some white
    // device at idx5 is fully OFF
    const out = applyTintToFrame(f, slots, 0, 1) // hue 0 = red, full amount
    // lit fixture -> pure red, white faded out, ch0 already bright enough
    expect(out[1]).toBe(255) // R washed in
    expect(out[3]).toBe(0)   // B gone
    expect(out[4]).toBe(0)   // white faded
    expect(out[0]).toBe(134)
    // dark fixture lit up with the wash
    expect(out[6]).toBe(255) // R
    expect(out[5]).toBe(134) // ch0 raised into the dimmer band (9 + 125)
  })
  it('partial amount raises dark fixtures proportionally and stays out of the strobe band', () => {
    const out = applyTintToFrame(frame(), slots, 0, 0.5)
    expect(out[5]).toBe(72)  // 9 + 0.5*125 = 71.5 -> 72, well under strobe band (135)
    expect(out[5]!).toBeLessThan(135)
  })
  it('amount 0 is a no-op', () => {
    const f = frame(); f[1] = 50
    expect(applyTintToFrame(f, slots, 0.5, 0)).toEqual(f)
  })
})

describe('applyBlinderToFrame', () => {
  it('forces full white on every rgbw fixture', () => {
    const out = applyBlinderToFrame(frame(), slots, 1)
    for (const s of slots) {
      expect(out[s.idx]).toBe(255)
      expect(out[s.idx + 1]).toBe(255)
      expect(out[s.idx + 4]).toBe(255)
    }
  })
})

describe('applyBlackoutToFrame', () => {
  it('zeros everything', () => {
    const f = frame(); f[0] = 200; f[7] = 99
    expect(applyBlackoutToFrame(f).every(v => v === 0)).toBe(true)
  })
})
