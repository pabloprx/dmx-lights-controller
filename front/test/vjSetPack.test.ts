import { describe, it, expect } from 'vitest'
import {
  VJ_PRESETS,
  VJ_SET_NAMES,
  LEGACY_VJ_SET_NAMES,
  buildVjSetPack,
} from '~/lib/vjSetPack'
import { BUILT_IN_PRESETS } from '~/types/dmx'

// Deterministic id factory so assertions are stable.
function counterIds() {
  let n = 0
  return () => `id${n++}`
}

const SIX = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']

const validPresetIds = new Set<string>([
  ...BUILT_IN_PRESETS.map(p => p.id),
  ...VJ_PRESETS.map(p => p.id),
])

// Playback samples at a fixed 1/4 (PLAYBACK_STEPS=4). Any clip whose start or
// duration is off the 0.25 grid can be skipped entirely - guard against it.
function onQuarterGrid(v: number): boolean {
  return Math.abs(v * 4 - Math.round(v * 4)) < 1e-9
}

describe('VJ pack palette', () => {
  it('has unique stable preset ids, none built-in', () => {
    const ids = VJ_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of VJ_PRESETS) {
      expect(p.isBuiltIn).toBe(false)
      expect(p.profileId).toBe('pinspot-rgbw-5ch')
    }
  })

  it('bass-reactive presets modulate the dimmer channel on bass', () => {
    const bass = VJ_PRESETS.filter(p => p.audioReactive?.enabled)
    expect(bass.length).toBeGreaterThanOrEqual(1)
    for (const p of bass) {
      expect(p.audioReactive!.band).toBe('bass')
      expect(p.audioReactive!.channel).toBe(0)
      expect(p.audioReactive!.min).toBeGreaterThanOrEqual(0)
      expect(p.audioReactive!.max).toBeLessThanOrEqual(100)
      expect(p.audioReactive!.min).toBeLessThan(p.audioReactive!.max)
    }
  })
})

describe('buildVjSetPack', () => {
  it('builds 40 sets: core 5/5/5/5 + 12 Garrix + 8 Techno', () => {
    const sets = buildVjSetPack(SIX, counterIds())
    expect(sets.length).toBe(40)
    expect(sets.map(s => s.name)).toEqual(VJ_SET_NAMES)
    const garrix = sets.filter(s => s.tags!.includes('Garrix'))
    const techno = sets.filter(s => s.tags!.includes('Techno'))
    const core = sets.filter(s => !s.tags!.includes('Garrix') && !s.tags!.includes('Techno'))
    expect(core.length).toBe(20)
    expect(garrix.length).toBe(12)
    expect(techno.length).toBe(8)
    const flat = core.flatMap(s => s.tags!)
    expect(flat.filter(t => t === 'Intro').length).toBe(5)
    expect(flat.filter(t => t === 'Buildup').length).toBe(5)
    expect(flat.filter(t => t === 'Drop').length).toBe(5)
    expect(flat.filter(t => t === 'FX').length).toBe(5)
    // every themed set: prefixed name + carries a section tag too
    const sections = ['Intro', 'Buildup', 'Drop', 'FX', 'Breakdown']
    for (const s of garrix) {
      expect(s.name.startsWith('MG ')).toBe(true)
      expect(s.tags!.some(t => sections.includes(t))).toBe(true)
    }
    for (const s of techno) {
      expect(s.name.startsWith('TK ')).toBe(true)
      expect(s.tags!.some(t => sections.includes(t))).toBe(true)
    }
  })

  it('legacy names are disjoint from current names (clean upgrade)', () => {
    const cur = new Set(VJ_SET_NAMES)
    expect(LEGACY_VJ_SET_NAMES.some(n => cur.has(n))).toBe(false)
  })

  it('every clip references a real track and a real preset', () => {
    const sets = buildVjSetPack(SIX, counterIds())
    for (const set of sets) {
      const trackIds = new Set(set.tracks.map(t => t.id))
      for (const clip of set.clips) {
        expect(trackIds.has(clip.trackId)).toBe(true)
        expect(validPresetIds.has(clip.presetId)).toBe(true)
      }
    }
  })

  it('binds tracks to the supplied device ids in venue order', () => {
    const sets = buildVjSetPack(SIX, counterIds())
    for (const set of sets) {
      expect(set.tracks.length).toBe(6)
      expect(set.tracks.map(t => t.targetId)).toEqual(SIX)
      expect(set.tracks.every(t => t.targetType === 'device')).toBe(true)
    }
  })

  it('keeps every clip inside the window AND on the 1/4 playback grid', () => {
    const sets = buildVjSetPack(SIX, counterIds())
    for (const set of sets) {
      for (const clip of set.clips) {
        expect(clip.startBeat).toBeGreaterThanOrEqual(1)
        expect(clip.duration).toBeGreaterThan(0)
        expect(clip.startBeat + clip.duration).toBeLessThanOrEqual(set.length + 1 + 1e-9)
        expect(onQuarterGrid(clip.startBeat)).toBe(true)
        expect(onQuarterGrid(clip.duration)).toBe(true)
      }
    }
  })

  it('drops use sub-beat clips (quarter + half durations)', () => {
    const sets = buildVjSetPack(SIX, counterIds())
    const slam = sets.find(s => s.name === 'Drop 1 - Strobe Slam')!
    expect(slam.clips.some(c => Math.abs(c.duration - 0.25) < 1e-9)).toBe(true)
    expect(slam.clips.some(c => Math.abs(c.duration - 0.5) < 1e-9)).toBe(true)
  })

  it('does not place clips on absent fixtures (small rig is safe)', () => {
    const sets = buildVjSetPack(['only-1', 'only-2'], counterIds())
    for (const set of sets) {
      expect(set.tracks.length).toBe(2)
      const trackIds = new Set(set.tracks.map(t => t.id))
      for (const clip of set.clips) {
        expect(trackIds.has(clip.trackId)).toBe(true)
      }
    }
  })

  it('produces fresh ids on each build (no shared object identity)', () => {
    const a = buildVjSetPack(SIX)
    const b = buildVjSetPack(SIX)
    const aTrackIds = new Set(a.flatMap(s => s.tracks.map(t => t.id)))
    const bTrackIds = b.flatMap(s => s.tracks.map(t => t.id))
    expect(bTrackIds.some(id => aTrackIds.has(id))).toBe(false)
  })
})
