// Tests for the pure DMX domain logic in app/types/dmx.ts.
// This module imports nothing framework-y, so it is exercised directly.

import { describe, it, expect } from 'vitest'
import {
  dimmerToCh0,
  valuesToDMX,
  STROBE_DMX,
  STROBE_MIN,
  STROBE_MAX,
  DIMMER_MIN,
  DIMMER_MAX,
  decodeFixture,
  presetToChannels,
  getPreviewColor,
  getPresetDisplayColor,
  createDefaultChannelValues,
  getProfileById,
  PINSPOT_RGBW,
  LASER_10CH,
  type PresetValues,
  type Device,
  type Preset,
} from '~/types/dmx'

function makeValues(overrides: Partial<PresetValues> = {}): PresetValues {
  return {
    dimmer: 255,
    strobe: false,
    strobeSpeed: 'medium',
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
    ...overrides,
  }
}

function pinspotAt(startChannel: number): Device {
  return {
    id: 'd1',
    name: 'Pinspot',
    profileId: 'pinspot-rgbw-5ch',
    startChannel,
    tags: [],
  }
}

// Build a flat DMX frame from a 1-indexed start channel + channel values.
function frameWith(startChannel: number, channels: number[], size = 100): number[] {
  const frame = new Array(size).fill(0)
  const start = startChannel - 1
  channels.forEach((v, i) => {
    frame[start + i] = v
  })
  return frame
}

describe('dimmerToCh0', () => {
  it('maps 0 -> 9 (band floor)', () => {
    expect(dimmerToCh0(0)).toBe(9)
  })

  it('maps 255 -> 134 (band ceiling)', () => {
    expect(dimmerToCh0(255)).toBe(134)
  })

  it('clamps out-of-range input', () => {
    expect(dimmerToCh0(-100)).toBe(9)
    expect(dimmerToCh0(99999)).toBe(134)
  })

  it('is monotonically non-decreasing', () => {
    let prev = -Infinity
    for (let d = 0; d <= 255; d += 5) {
      const v = dimmerToCh0(d)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('stays within the 9-134 band for all inputs', () => {
    for (let d = 0; d <= 255; d += 1) {
      const v = dimmerToCh0(d)
      expect(v).toBeGreaterThanOrEqual(DIMMER_MIN)
      expect(v).toBeLessThanOrEqual(DIMMER_MAX)
    }
  })
})

describe('valuesToDMX', () => {
  it('dimmer mode maps ch0 via dimmerToCh0 and passes rgbw through', () => {
    const out = valuesToDMX(makeValues({ dimmer: 255, red: 10, green: 20, blue: 30, white: 40 }))
    expect(out).toEqual([134, 10, 20, 30, 40])
  })

  it('strobe mode emits STROBE_DMX[speed] for ch0', () => {
    expect(valuesToDMX(makeValues({ strobe: true, strobeSpeed: 'slow' }))[0]).toBe(STROBE_DMX.slow)
    expect(valuesToDMX(makeValues({ strobe: true, strobeSpeed: 'medium' }))[0]).toBe(STROBE_DMX.medium)
    expect(valuesToDMX(makeValues({ strobe: true, strobeSpeed: 'fast' }))[0]).toBe(STROBE_DMX.fast)
  })

  it('always returns [ch0, r, g, b, w] (length 5)', () => {
    expect(valuesToDMX(makeValues())).toHaveLength(5)
  })
})

describe('STROBE_DMX', () => {
  it('is ordered slow < medium < fast', () => {
    expect(STROBE_DMX.slow).toBeLessThan(STROBE_DMX.medium)
    expect(STROBE_DMX.medium).toBeLessThan(STROBE_DMX.fast)
  })

  it('keeps every speed within the 135-239 strobe band', () => {
    for (const v of Object.values(STROBE_DMX)) {
      expect(v).toBeGreaterThanOrEqual(STROBE_MIN)
      expect(v).toBeLessThanOrEqual(STROBE_MAX)
    }
  })
})

describe('decodeFixture (RGBW / PinSpot)', () => {
  it('ch0 = 9 -> intensity01 ~ 0', () => {
    const s = decodeFixture(frameWith(1, [9, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)
    expect(s.intensity01).toBeCloseTo(0, 5)
  })

  it('ch0 = 134 -> intensity01 ~ 1', () => {
    const s = decodeFixture(frameWith(1, [134, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)
    expect(s.intensity01).toBeCloseTo(1, 5)
  })

  it('ch0 >= 240 -> intensity01 = 1 (full band)', () => {
    const s = decodeFixture(frameWith(1, [255, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)
    expect(s.intensity01).toBe(1)
  })

  it('ch0 in strobe band -> strobe with monotonic strobeSpeed01 in 0..1', () => {
    const slow = decodeFixture(frameWith(1, [STROBE_MIN, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)
    const mid = decodeFixture(frameWith(1, [190, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)
    const fast = decodeFixture(frameWith(1, [STROBE_MAX, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW)

    expect(slow.strobe).toBe(true)
    expect(mid.strobe).toBe(true)
    expect(fast.strobe).toBe(true)

    expect(slow.strobeSpeed01).toBeCloseTo(0, 5)
    expect(fast.strobeSpeed01).toBeCloseTo(1, 5)
    expect(mid.strobeSpeed01).toBeGreaterThan(slow.strobeSpeed01)
    expect(mid.strobeSpeed01).toBeLessThan(fast.strobeSpeed01)

    // In strobe mode the RGB channels carry the level -> intensity forced to 1
    expect(slow.intensity01).toBe(1)
  })

  it('passes rgb + white through unchanged', () => {
    const s = decodeFixture(frameWith(1, [134, 11, 22, 33, 44]), pinspotAt(1), PINSPOT_RGBW)
    expect(s.rgb).toEqual([11, 22, 33])
    expect(s.white).toBe(44)
  })

  it('active requires intensity > 0 AND (color or strobe)', () => {
    // intensity 0 (ch0 = 9) -> inactive even with color
    expect(decodeFixture(frameWith(1, [9, 255, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW).active).toBe(false)
    // intensity but no color and no strobe -> inactive
    expect(decodeFixture(frameWith(1, [134, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW).active).toBe(false)
    // intensity + color -> active
    expect(decodeFixture(frameWith(1, [134, 255, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW).active).toBe(true)
    // strobe (no color) -> active (intensity forced to 1, strobe true)
    expect(decodeFixture(frameWith(1, [150, 0, 0, 0, 0]), pinspotAt(1), PINSPOT_RGBW).active).toBe(true)
    // white alone counts as color
    expect(decodeFixture(frameWith(1, [134, 0, 0, 0, 255]), pinspotAt(1), PINSPOT_RGBW).active).toBe(true)
  })

  it('reads from the correct offset for a device at startChannel > 1', () => {
    const frame = frameWith(6, [134, 7, 8, 9, 10]) // occupies channels 6..10
    const s = decodeFixture(frame, pinspotAt(6), PINSPOT_RGBW)
    expect(s.intensity01).toBeCloseTo(1, 5)
    expect(s.rgb).toEqual([7, 8, 9])
    expect(s.white).toBe(10)
  })

  it('treats missing frame slots as 0 (no throw)', () => {
    const s = decodeFixture([], pinspotAt(1), PINSPOT_RGBW)
    expect(s.intensity01).toBe(0)
    expect(s.active).toBe(false)
  })
})

describe('decodeFixture (non-RGBW / Laser)', () => {
  const laserDevice: Device = {
    id: 'l1',
    name: 'Laser',
    profileId: 'laser-10ch',
    startChannel: 1,
    tags: [],
  }

  it('returns a best-effort inactive state when all channels are 0', () => {
    const s = decodeFixture(frameWith(1, new Array(10).fill(0)), laserDevice, LASER_10CH)
    expect(s.intensity01).toBe(0)
    expect(s.active).toBe(false)
    expect(s.strobe).toBe(false)
  })

  it('is active with full intensity when any channel emits', () => {
    const channels = new Array(10).fill(0)
    channels[0] = 64 // Mode channel
    const s = decodeFixture(frameWith(1, channels), laserDevice, LASER_10CH)
    expect(s.intensity01).toBe(1)
    expect(s.active).toBe(true)
  })

  it('does not throw and yields valid rgb triple', () => {
    const channels = new Array(10).fill(0)
    channels[8] = 200 // Color channel
    const s = decodeFixture(frameWith(1, channels), laserDevice, LASER_10CH)
    expect(s.rgb).toHaveLength(3)
    s.rgb.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(255)
    })
  })
})

describe('presetToChannels', () => {
  it('dispatches to valuesToDMX when preset has values', () => {
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'pinspot-rgbw-5ch', isBuiltIn: false, category: 'color',
      values: makeValues({ dimmer: 255, red: 1, green: 2, blue: 3, white: 4 }),
    }
    expect(presetToChannels(preset)).toEqual([134, 1, 2, 3, 4])
  })

  it('passes channelValues through (copy) when no values', () => {
    const cv = [1, 2, 3, 4, 5]
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'laser-10ch', isBuiltIn: false, category: 'custom',
      channelValues: cv,
    }
    const out = presetToChannels(preset)
    expect(out).toEqual(cv)
    expect(out).not.toBe(cv) // must be a copy, not the same reference
  })

  it('returns [] when the preset has neither values nor channelValues', () => {
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'x', isBuiltIn: false, category: 'custom',
    }
    expect(presetToChannels(preset)).toEqual([])
  })
})

describe('getPreviewColor', () => {
  it('produces deterministic rgb() output', () => {
    expect(getPreviewColor(makeValues({ red: 255, green: 0, blue: 0 }))).toBe('rgb(255, 0, 0)')
  })

  it('folds white into the rgb channels (half weight, clamped)', () => {
    // red 100 + white 100*0.5 = 150 ; green/blue 0 + 50 = 50
    expect(getPreviewColor(makeValues({ red: 100, white: 100 }))).toBe('rgb(150, 50, 50)')
    // clamps at 255
    expect(getPreviewColor(makeValues({ red: 255, white: 255 }))).toBe('rgb(255, 128, 128)')
  })
})

describe('getPresetDisplayColor', () => {
  it('uses preview color for RGBW presets with values', () => {
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'pinspot-rgbw-5ch', isBuiltIn: false, category: 'color',
      values: makeValues({ red: 0, green: 255, blue: 0 }),
    }
    expect(getPresetDisplayColor(preset)).toBe('rgb(0, 255, 0)')
  })

  it('derives an hsl() hue from the Color channel for slider presets', () => {
    const channelValues = new Array(10).fill(0)
    channelValues[8] = 128 // Color channel offset 8 -> hue ~180.7
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'laser-10ch', isBuiltIn: false, category: 'custom',
      channelValues,
    }
    const hue = (128 / 255) * 360
    expect(getPresetDisplayColor(preset)).toBe(`hsl(${hue}, 70%, 50%)`)
  })

  it('falls back to default purple for an unknown profile', () => {
    const preset: Preset = {
      id: 'p', name: 'P', profileId: 'does-not-exist', isBuiltIn: false, category: 'custom',
    }
    expect(getPresetDisplayColor(preset)).toBe('#8b5cf6')
  })
})

describe('createDefaultChannelValues', () => {
  it('returns the profile channel defaults for a known profile', () => {
    expect(createDefaultChannelValues('pinspot-rgbw-5ch')).toEqual(
      PINSPOT_RGBW.channels.map(c => c.defaultValue),
    )
    expect(createDefaultChannelValues('laser-10ch')).toEqual(
      LASER_10CH.channels.map(c => c.defaultValue),
    )
  })

  it('returns [] for an unknown profile', () => {
    expect(createDefaultChannelValues('nope')).toEqual([])
  })
})

describe('getProfileById', () => {
  it('returns the profile for a known id', () => {
    expect(getProfileById('pinspot-rgbw-5ch')).toBe(PINSPOT_RGBW)
    expect(getProfileById('laser-10ch')).toBe(LASER_10CH)
  })

  it('returns undefined for an unknown id', () => {
    expect(getProfileById('unknown')).toBeUndefined()
  })
})
