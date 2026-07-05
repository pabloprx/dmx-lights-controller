// VJ Set Pack - a curated, hand-built library of 6 lighting sets (2 Intro,
// 2 Buildup, 2 Drop) for a 6x PinSpot RGBW rig. Pure + unit-tested.
//
// Venue orientation (the layout the looks are choreographed around):
//
//        <dj booth>
//          1 v 4
//          2 v 5
//          3 v 6
//         <entry>
//
// Fixtures are mapped by DMX address order (sorted by startChannel) to these
// positions, so fixture N = the Nth pinspot. Left column = 1,2,3 / right = 4,5,6.
// Rows by depth: front/booth = (1,4), mid = (2,5), back/entry = (3,6).
//
// The pack ships its OWN palette (deeper colours, colour strobes, bass-reactive
// looks) since the built-in presets are intentionally minimal.

import type { Preset, Set, SetTrack, SetClip, SetLength } from '~/types/dmx'
import { generateId } from '~/types/dmx'

// ═══════════════════════════════════════════════════════════════
// FIXTURE POSITIONS (0-indexed into the channel-sorted pinspot list)
// ═══════════════════════════════════════════════════════════════
const LF = 0 // left-front  (fixture 1, near booth)
const LM = 1 // left-mid    (fixture 2)
const LB = 2 // left-back   (fixture 3, near entry)
const RF = 3 // right-front (fixture 4, near booth)
const RM = 4 // right-mid   (fixture 5)
const RB = 5 // right-back  (fixture 6, near entry)

// Spatial groupings the choreography speaks in.
const ALL = [LF, LM, LB, RF, RM, RB]
const LEFT = [LF, LM, LB]
const RIGHT = [RF, RM, RB]
const FRONT = [LF, RF] // booth pair
const MID = [LM, RM]
const BACK = [LB, RB] // entry pair

// Per-position track metadata (name + UI colour), index-aligned to fixtures 1..6.
const TRACK_META: { name: string; color: string }[] = [
  { name: 'L-Front', color: '#3b82f6' },
  { name: 'L-Mid', color: '#06b6d4' },
  { name: 'L-Back', color: '#8b5cf6' },
  { name: 'R-Front', color: '#f97316' },
  { name: 'R-Mid', color: '#eab308' },
  { name: 'R-Back', color: '#ec4899' },
]

// ═══════════════════════════════════════════════════════════════
// CURATED PALETTE (stable ids -> idempotent when (re)loaded into the store)
// ═══════════════════════════════════════════════════════════════
function color(
  id: string,
  name: string,
  red: number,
  green: number,
  blue: number,
  opts: { white?: number; dimmer?: number } = {},
): Preset {
  return {
    id,
    name,
    profileId: 'pinspot-rgbw-5ch',
    isBuiltIn: false,
    category: 'color',
    values: {
      dimmer: opts.dimmer ?? 255,
      strobe: false,
      strobeSpeed: 'medium',
      red,
      green,
      blue,
      white: opts.white ?? 0,
    },
  }
}

function strobe(id: string, name: string, red: number, green: number, blue: number): Preset {
  return {
    id,
    name,
    profileId: 'pinspot-rgbw-5ch',
    isBuiltIn: false,
    category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'fast', red, green, blue, white: 0 },
  }
}

// Bass-reactive look: colour is fixed, channel-0 dimmer pumps with the kick.
// min/max are PERCENT of the 9-134 dimmer band (55% floor so it still reads
// strong with no audio source, snaps to 100% on a bass hit).
function bass(id: string, name: string, red: number, green: number, blue: number, white = 0): Preset {
  return {
    id,
    name,
    profileId: 'pinspot-rgbw-5ch',
    isBuiltIn: false,
    category: 'custom',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red, green, blue, white },
    audioReactive: {
      enabled: true,
      band: 'bass',
      channel: 0,
      threshold: 6,
      min: 55,
      max: 100,
      curve: 'linear',
    },
  }
}

export const VJ_PRESETS: Preset[] = [
  // Saturated colours
  color('vj-indigo', 'Indigo', 40, 0, 200),
  color('vj-deep-purple', 'Deep Purple', 150, 0, 255),
  color('vj-magenta', 'Magenta', 255, 0, 150),
  color('vj-hot-pink', 'Hot Pink', 255, 30, 90),
  color('vj-amber', 'Amber', 255, 70, 0),
  color('vj-gold', 'Gold', 255, 140, 0),
  color('vj-teal', 'Teal', 0, 200, 150),
  color('vj-ice', 'Ice Blue', 0, 120, 255, { white: 30 }),
  // Moody low-intensity beds (for intros / breakdowns)
  color('vj-indigo-low', 'Indigo (low)', 40, 0, 200, { dimmer: 75 }),
  color('vj-purple-low', 'Purple (low)', 150, 0, 255, { dimmer: 80 }),
  color('vj-amber-low', 'Amber (low)', 255, 70, 0, { dimmer: 70 }),
  color('vj-blue-low', 'Blue (low)', 0, 60, 255, { dimmer: 85 }),
  color('vj-red-low', 'Red (low)', 255, 0, 0, { dimmer: 80 }),
  color('vj-magenta-low', 'Magenta (low)', 255, 0, 150, { dimmer: 80 }),
  color('vj-teal-low', 'Teal (low)', 0, 200, 150, { dimmer: 75 }),
  color('vj-ice-low', 'Ice (low)', 0, 120, 255, { white: 20, dimmer: 70 }),
  color('vj-warm-low', 'Warm (low)', 255, 150, 60, { white: 50, dimmer: 70 }),
  // Colour strobes
  strobe('vj-strobe-blue-fast', 'Strobe Blue', 0, 0, 255),
  strobe('vj-strobe-magenta-fast', 'Strobe Magenta', 255, 0, 150),
  strobe('vj-strobe-red-fast', 'Strobe Red', 255, 0, 0),
  // Bass-reactive
  bass('vj-bass-cyan', 'Bass Cyan', 0, 255, 255),
  bass('vj-bass-magenta', 'Bass Magenta', 255, 0, 150),
  bass('vj-bass-green', 'Bass Green', 0, 255, 60),
  // Martin Garrix show palette (designed for the MG sets below)
  color('vj-mg-white-blinder', 'MG Whiteout Blinder', 255, 255, 255, { white: 255 }),
  color('vj-mg-warm-blinder', 'MG Gold Pyro Blinder', 255, 190, 110, { white: 200 }),
  color('vj-mg-ember-low', 'MG Ember Low', 255, 48, 0, { dimmer: 60 }),
  strobe('vj-mg-gold-strobe', 'MG Gold Strobe', 255, 180, 40),
  bass('vj-mg-bass-white', 'MG Bass White Pump', 255, 255, 255, 255),
  bass('vj-mg-bass-ice', 'MG Bass Ice Pump', 100, 160, 255, 40),
  bass('vj-mg-bass-red', 'MG Bass Red', 255, 0, 0),
]

// ═══════════════════════════════════════════════════════════════
// CHOREOGRAPHY (a compact spec compiled into tracks + clips)
// ═══════════════════════════════════════════════════════════════
// One ClipSpec paints the same preset on every listed fixture at the same time.
interface ClipSpec {
  fx: number[]
  preset: string
  start: number // 1-indexed beat (may be fractional)
  dur: number // beats (may be fractional)
}

interface SetSpec {
  name: string
  tags: string[]
  subdivision: number // editor grid (pencil) - playback samples finely regardless
  clips: ClipSpec[]
}

// ── pattern generators (DRY for the repetitive FX/roll looks) ───────────────
// All positions land on the quarter-note grid (multiples of 0.25) because
// playback samples at a fixed 1/4 (PLAYBACK_STEPS) - finer notes never fire.

// A short pop on the "1" of every beat.
function beatPops(preset: string, fx: number[] = ALL, dur = 0.25): ClipSpec[] {
  return Array.from({ length: 8 }, (_, i) => ({ fx, preset, start: i + 1, dur }))
}

// Police: left/right colour strobes alternating each half-beat for 8 beats.
function policePattern(): ClipSpec[] {
  const out: ClipSpec[] = []
  for (let b = 1; b <= 8; b++) {
    out.push({ fx: LEFT, preset: 'vj-strobe-red-fast', start: b, dur: 0.5 })
    out.push({ fx: RIGHT, preset: 'vj-strobe-blue-fast', start: b + 0.5, dur: 0.5 })
  }
  return out
}

// A single strobe running through the fixtures, one per quarter-note, looping.
function strobeChasePattern(order: number[], preset = 'builtin-strobe-fast'): ClipSpec[] {
  return Array.from({ length: 32 }, (_, i) => ({
    fx: [order[i % order.length]!],
    preset,
    start: 1 + i * 0.25,
    dur: 0.25,
  }))
}

// Fire chase: a pair runs booth<->entry, one pair per quarter (3 beats).
function fireChaseBar(startBeat: number, dir: 'fwd' | 'rev'): ClipSpec[] {
  const seq = dir === 'fwd'
    ? [
        { fx: FRONT, p: 'builtin-red' }, { fx: MID, p: 'vj-amber' },
        { fx: BACK, p: 'vj-gold' }, { fx: MID, p: 'vj-amber' },
      ]
    : [
        { fx: BACK, p: 'vj-gold' }, { fx: MID, p: 'vj-amber' },
        { fx: FRONT, p: 'builtin-red' }, { fx: MID, p: 'vj-amber' },
      ]
  return Array.from({ length: 12 }, (_, i) => {
    const s = seq[i % seq.length]!
    return { fx: s.fx, preset: s.p, start: startBeat + i * 0.25, dur: 0.25 }
  })
}

// Accelerating snare roll: halves -> quarters -> gold quarters -> strobe peak.
function snareRush(): ClipSpec[] {
  const out: ClipSpec[] = [
    { fx: ALL, preset: 'builtin-white', start: 1, dur: 0.5 },
    { fx: ALL, preset: 'builtin-white', start: 2, dur: 0.5 },
  ]
  for (const s of [3, 3.5, 4, 4.5]) out.push({ fx: ALL, preset: 'builtin-white', start: s, dur: 0.25 })
  for (let i = 0; i < 8; i++) out.push({ fx: ALL, preset: 'vj-gold', start: 5 + i * 0.25, dur: 0.25 })
  for (let i = 0; i < 4; i++) out.push({ fx: ALL, preset: 'builtin-white', start: 7 + i * 0.25, dur: 0.25 })
  out.push({ fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 })
  return out
}

// Hyper strobe: colour strobes with dark gaps, then colour/strobe quarters.
function hyperStrobe(): ClipSpec[] {
  const slams = ['builtin-strobe-fast', 'vj-strobe-blue-fast', 'vj-strobe-magenta-fast', 'builtin-strobe-fast']
  const out: ClipSpec[] = slams.map((p, i) => ({ fx: ALL, preset: p, start: 1 + i, dur: 0.5 }))
  const colors = ['builtin-red', 'builtin-blue', 'vj-magenta']
  for (let i = 0; i < 16; i++) {
    const preset = i % 2 === 1 ? 'builtin-strobe-fast' : colors[(i >> 1) % colors.length]!
    out.push({ fx: ALL, preset, start: 5 + i * 0.25, dur: 0.25 })
  }
  return out
}

export const VJ_SET_SPECS: SetSpec[] = [
  // ═══════════════════════════ INTRO (5) ═══════════════════════════
  // Cool, moody. Dim indigo bed; a pair breathes booth->entry, hue indigo->purple->blue.
  {
    name: 'Intro 1 - Deep Pulse',
    tags: ['Intro'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-indigo-low', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-indigo', start: 1, dur: 2 },
      { fx: MID, preset: 'vj-deep-purple', start: 3, dur: 2 },
      { fx: BACK, preset: 'builtin-blue', start: 5, dur: 2 },
      { fx: MID, preset: 'vj-deep-purple', start: 7, dur: 2 },
    ],
  },
  // Warm, anticipatory. Back row holds a "horizon"; a gold pulse sways booth<->mid.
  {
    name: 'Intro 2 - Amber Horizon',
    tags: ['Intro'],
    subdivision: 1,
    clips: [
      { fx: BACK, preset: 'vj-amber-low', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-gold', start: 1, dur: 2 },
      { fx: MID, preset: 'vj-amber-low', start: 3, dur: 2 },
      { fx: FRONT, preset: 'vj-gold', start: 5, dur: 2 },
      { fx: MID, preset: 'vj-amber', start: 7, dur: 2 },
    ],
  },
  // Cool teal/ice drifting left<->right over a low-blue bed.
  {
    name: 'Intro 3 - Teal Drift',
    tags: ['Intro'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-blue-low', start: 1, dur: 8 },
      { fx: LEFT, preset: 'vj-teal', start: 1, dur: 2 },
      { fx: RIGHT, preset: 'vj-ice', start: 3, dur: 2 },
      { fx: LEFT, preset: 'vj-teal', start: 5, dur: 2 },
      { fx: RIGHT, preset: 'vj-ice', start: 7, dur: 2 },
    ],
  },
  // Dark and tense. Deep-red bed; a crimson wave rolls booth->entry->back.
  {
    name: 'Intro 4 - Crimson Low',
    tags: ['Intro'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-red-low', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-magenta-low', start: 1, dur: 2 },
      { fx: MID, preset: 'vj-magenta-low', start: 3, dur: 2 },
      { fx: BACK, preset: 'vj-magenta-low', start: 5, dur: 2 },
      { fx: MID, preset: 'vj-magenta-low', start: 7, dur: 2 },
    ],
  },
  // Icy, minimal "lights waking". Ice bed, ice accents settling.
  {
    name: 'Intro 5 - Frost',
    tags: ['Intro'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-ice-low', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-ice', start: 1, dur: 2 },
      { fx: BACK, preset: 'vj-ice', start: 3, dur: 2 },
      { fx: MID, preset: 'vj-ice', start: 5, dur: 2 },
      { fx: ALL, preset: 'vj-ice-low', start: 7, dur: 2 },
    ],
  },
  // ═══════════════════════════ BUILDUP (5) ═══════════════════════════
  // Riser: L/R white sweep, doubles to half-beat cyan stabs, peaks full white.
  {
    name: 'Build 1 - Riser Sweep',
    tags: ['Buildup'],
    subdivision: 2,
    clips: [
      { fx: LEFT, preset: 'builtin-white', start: 1, dur: 1 },
      { fx: RIGHT, preset: 'builtin-white', start: 2, dur: 1 },
      { fx: LEFT, preset: 'builtin-cyan', start: 3, dur: 1 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 4, dur: 1 },
      { fx: LEFT, preset: 'builtin-cyan', start: 5.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 5.5, dur: 0.5 },
      { fx: LEFT, preset: 'builtin-cyan', start: 6.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 6.5, dur: 0.5 },
      { fx: LEFT, preset: 'builtin-white', start: 7.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-white', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-white', start: 8, dur: 1 },
    ],
  },
  // Accumulation: rows light booth->crowd, hue climbs blue->magenta->white, strobe tease.
  {
    name: 'Build 2 - Color Climb',
    tags: ['Buildup'],
    subdivision: 2,
    clips: [
      { fx: FRONT, preset: 'builtin-blue', start: 1, dur: 1 },
      { fx: [...FRONT, ...MID], preset: 'builtin-blue', start: 2, dur: 1 },
      { fx: ALL, preset: 'vj-magenta', start: 3, dur: 1 },
      { fx: ALL, preset: 'builtin-white', start: 4, dur: 1 },
      { fx: ALL, preset: 'vj-magenta', start: 5.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-white', start: 5.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-magenta', start: 6.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-white', start: 6.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-magenta', start: 7.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-white', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Pendulum: magenta/cyan L<->R swing that accelerates to quarters, ends strobe.
  {
    name: 'Build 3 - Pendulum',
    tags: ['Buildup'],
    subdivision: 4,
    clips: [
      { fx: LEFT, preset: 'vj-magenta', start: 1, dur: 1 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 2, dur: 1 },
      { fx: LEFT, preset: 'vj-magenta', start: 3.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 3.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-magenta', start: 4.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 4.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-magenta', start: 5.0, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 5.25, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 5.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 5.75, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 6.0, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 6.25, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 6.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 6.75, dur: 0.25 },
      { fx: ALL, preset: 'vj-magenta', start: 7.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-cyan', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Stairs: rows climb booth->entry, hue blue->teal->green->white, repeats faster.
  {
    name: 'Build 4 - Stairs Up',
    tags: ['Buildup'],
    subdivision: 2,
    clips: [
      { fx: FRONT, preset: 'builtin-blue', start: 1, dur: 1 },
      { fx: MID, preset: 'vj-teal', start: 2, dur: 1 },
      { fx: BACK, preset: 'builtin-green', start: 3, dur: 1 },
      { fx: ALL, preset: 'builtin-white', start: 4, dur: 1 },
      { fx: FRONT, preset: 'builtin-blue', start: 5.0, dur: 0.5 },
      { fx: MID, preset: 'vj-teal', start: 5.5, dur: 0.5 },
      { fx: BACK, preset: 'builtin-green', start: 6.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-white', start: 6.5, dur: 0.5 },
      { fx: FRONT, preset: 'builtin-blue', start: 7.0, dur: 0.5 },
      { fx: MID, preset: 'vj-teal', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Snare rush: accelerating white roll into a gold quarter-roll and strobe peak.
  {
    name: 'Build 5 - Snare Rush',
    tags: ['Buildup'],
    subdivision: 4,
    clips: snareRush(),
  },
  // ═══════════════════════════ DROP (5) ═══════════════════════════
  // Peak. Colour slam split on the 1 (red->magenta), strobe accents, quarter L/R bounce.
  {
    name: 'Drop 1 - Strobe Slam',
    tags: ['Drop'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'builtin-red', start: 1.0, dur: 0.5 },
      { fx: ALL, preset: 'vj-magenta', start: 1.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 2, dur: 1 },
      { fx: LEFT, preset: 'builtin-red', start: 3.0, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-magenta', start: 3.25, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 3.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-red', start: 3.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 4, dur: 1 },
      { fx: ALL, preset: 'builtin-blue', start: 5.0, dur: 0.5 },
      { fx: ALL, preset: 'builtin-cyan', start: 5.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-strobe-blue-fast', start: 6, dur: 1 },
      { fx: LEFT, preset: 'builtin-cyan', start: 7.0, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-blue', start: 7.25, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-blue', start: 7.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 7.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Groove: bass-reactive beams bounce booth<->entry, colours rotate, L/R cross in bar 2.
  {
    name: 'Drop 2 - Bounce Groove',
    tags: ['Drop'],
    subdivision: 2,
    clips: [
      { fx: FRONT, preset: 'vj-bass-cyan', start: 1.0, dur: 0.5 },
      { fx: MID, preset: 'vj-bass-cyan', start: 1.5, dur: 0.5 },
      { fx: BACK, preset: 'vj-bass-magenta', start: 2.0, dur: 0.5 },
      { fx: MID, preset: 'vj-bass-magenta', start: 2.5, dur: 0.5 },
      { fx: FRONT, preset: 'vj-bass-green', start: 3.0, dur: 0.5 },
      { fx: MID, preset: 'vj-bass-green', start: 3.5, dur: 0.5 },
      { fx: BACK, preset: 'vj-bass-cyan', start: 4.0, dur: 0.5 },
      { fx: MID, preset: 'vj-bass-cyan', start: 4.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-bass-magenta', start: 5.0, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-bass-magenta', start: 5.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-bass-cyan', start: 6.0, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-bass-cyan', start: 6.5, dur: 0.5 },
      { fx: FRONT, preset: 'vj-bass-green', start: 7.0, dur: 0.5 },
      { fx: MID, preset: 'vj-bass-green', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-bass-magenta', start: 8.0, dur: 0.5 },
      { fx: ALL, preset: 'vj-strobe-magenta-fast', start: 8.5, dur: 0.5 },
    ],
  },
  // Colour war: LEFT vs RIGHT battle in contrasting hues, rapid swaps + strobe punches.
  {
    name: 'Drop 3 - Color War',
    tags: ['Drop'],
    subdivision: 4,
    clips: [
      { fx: LEFT, preset: 'builtin-red', start: 1.0, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-blue', start: 1.0, dur: 0.5 },
      { fx: LEFT, preset: 'builtin-blue', start: 1.5, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-red', start: 1.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 2, dur: 1 },
      { fx: LEFT, preset: 'vj-magenta', start: 3.0, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 3.0, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-cyan', start: 3.25, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-magenta', start: 3.25, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 3.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-cyan', start: 3.5, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-cyan', start: 3.75, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-magenta', start: 3.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 4, dur: 1 },
      { fx: LEFT, preset: 'builtin-green', start: 5.0, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-magenta', start: 5.0, dur: 0.5 },
      { fx: LEFT, preset: 'vj-magenta', start: 5.5, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-green', start: 5.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-strobe-magenta-fast', start: 6, dur: 1 },
      { fx: LEFT, preset: 'builtin-green', start: 7.0, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-magenta', start: 7.0, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 7.25, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-green', start: 7.25, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-green', start: 7.5, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-magenta', start: 7.5, dur: 0.25 },
      { fx: LEFT, preset: 'vj-magenta', start: 7.75, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-green', start: 7.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Fire chase: a pair runs booth<->entry in fire colours, reverses in bar 2, strobe caps.
  {
    name: 'Drop 4 - Fire Chase',
    tags: ['Drop'],
    subdivision: 4,
    clips: [
      ...fireChaseBar(1, 'fwd'),
      { fx: ALL, preset: 'builtin-strobe-fast', start: 4, dur: 1 },
      ...fireChaseBar(5, 'rev'),
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8, dur: 1 },
    ],
  },
  // Hyper strobe: full-rig colour strobes with dark gaps, then colour/strobe quarters.
  {
    name: 'Drop 5 - Hyper Strobe',
    tags: ['Drop'],
    subdivision: 4,
    clips: hyperStrobe(),
  },
  // ═══════════════════════════ FX / ANYTIME (5) ═══════════════════════════
  // Rainbow wash: every fixture a different hue, rotating once at the halfway point.
  {
    name: 'FX 1 - Rainbow Wash',
    tags: ['FX'],
    subdivision: 1,
    clips: [
      { fx: [LF], preset: 'builtin-red', start: 1, dur: 4 },
      { fx: [LM], preset: 'vj-gold', start: 1, dur: 4 },
      { fx: [LB], preset: 'builtin-green', start: 1, dur: 4 },
      { fx: [RF], preset: 'builtin-cyan', start: 1, dur: 4 },
      { fx: [RM], preset: 'builtin-blue', start: 1, dur: 4 },
      { fx: [RB], preset: 'vj-magenta', start: 1, dur: 4 },
      { fx: [LF], preset: 'vj-magenta', start: 5, dur: 4 },
      { fx: [LM], preset: 'builtin-red', start: 5, dur: 4 },
      { fx: [LB], preset: 'vj-gold', start: 5, dur: 4 },
      { fx: [RF], preset: 'builtin-green', start: 5, dur: 4 },
      { fx: [RM], preset: 'builtin-cyan', start: 5, dur: 4 },
      { fx: [RB], preset: 'builtin-blue', start: 5, dur: 4 },
    ],
  },
  // Police: red-left / blue-right alternating strobes - classic emergency look.
  {
    name: 'FX 2 - Police',
    tags: ['FX'],
    subdivision: 2,
    clips: policePattern(),
  },
  // Blinder pulse: full-white audience hit on every beat, dark between.
  {
    name: 'FX 3 - Blinder Pulse',
    tags: ['FX'],
    subdivision: 2,
    clips: beatPops('builtin-white', ALL, 0.25),
  },
  // Breakdown glow: calm two-tone purple/blue breathing, no movement - a cooldown.
  {
    name: 'FX 4 - Breakdown Glow',
    tags: ['FX'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-purple-low', start: 1, dur: 4 },
      { fx: ALL, preset: 'vj-blue-low', start: 5, dur: 4 },
    ],
  },
  // Strobe chase: a single white strobe runs through the rig booth->entry, looping.
  {
    name: 'FX 5 - Strobe Chase',
    tags: ['FX'],
    subdivision: 4,
    clips: strobeChasePattern([LF, LM, LB, RF, RM, RB]),
  },
  // ═══════════════ MARTIN GARRIX SHOW (12) - tagged 'Garrix' ═══════════════
  // Two designed arcs: STMPD anthem (whiteout walls, gold pyro, ice intros,
  // sidechain pumps) + Animals-era dark energy (off-beat bounce, red/white
  // strobe war, tunnel chases). All carry their EDM section tag AND 'Garrix'
  // so the Perform section filter gets a dedicated Garrix chip.
  // Dim blue bed with a sidechain-breathing ice centre and a slow booth-to-entry-and-back ice wave, closing on a diagonal cross glint; fire for elegant Ocean/High On Life intro passages.
  {
    name: 'MG 1 - Ocean Glass',
    tags: ['Intro', 'Garrix'],
    subdivision: 2,
    clips: [
      { fx: ALL, preset: 'vj-blue-low', start: 1, dur: 8 },
      { fx: MID, preset: 'vj-mg-bass-ice', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-ice', start: 1, dur: 1 },
      { fx: MID, preset: 'vj-ice', start: 2, dur: 1 },
      { fx: BACK, preset: 'vj-ice', start: 3, dur: 1 },
      { fx: BACK, preset: 'vj-ice', start: 5, dur: 1 },
      { fx: MID, preset: 'vj-ice', start: 6, dur: 1 },
      { fx: FRONT, preset: 'vj-ice', start: 7, dur: 1 },
      { fx: [0, 5], preset: 'vj-ice', start: 8, dur: 0.5 },
      { fx: [2, 3], preset: 'vj-ice', start: 8.5, dur: 0.5 },
    ],
  },
  // Melodic riser: booth-to-entry runs that double in speed each pass (ice half-notes to cyan eighths to white sixteenths) and snap into a full whiteout on the last half beat; fire on the melodic 8-bar rise before an anthem drop.
  {
    name: 'MG 2 - Ice Climb',
    tags: ['Buildup', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-blue-low', start: 1, dur: 4 },
      { fx: ALL, preset: 'vj-ice-low', start: 5, dur: 3.5 },
      { fx: FRONT, preset: 'vj-ice', start: 1, dur: 1 },
      { fx: MID, preset: 'vj-ice', start: 2, dur: 1 },
      { fx: BACK, preset: 'vj-ice', start: 3, dur: 1 },
      { fx: FRONT, preset: 'builtin-cyan', start: 4, dur: 0.5 },
      { fx: MID, preset: 'builtin-cyan', start: 4.5, dur: 0.5 },
      { fx: BACK, preset: 'builtin-cyan', start: 5, dur: 0.5 },
      { fx: FRONT, preset: 'builtin-cyan', start: 5.5, dur: 0.5 },
      { fx: MID, preset: 'builtin-cyan', start: 6, dur: 0.5 },
      { fx: BACK, preset: 'builtin-cyan', start: 6.5, dur: 0.5 },
      { fx: FRONT, preset: 'builtin-white', start: 7, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 7.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 7.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 7.75, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 8, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 8.25, dur: 0.25 },
      { fx: ALL, preset: 'vj-mg-white-blinder', start: 8.5, dur: 0.5 },
    ],
  },
  // Anthem drop: blinding white wall on the 1 and a gold pyro wall on the 5, sidechained white pump in the mids under front/back and diagonal quarter-note ticks, with a black pop at 8.75 so the loop slams back into the wall; fire on the drop's first bar.
  {
    name: 'MG 3 - Whiteout Anthem',
    tags: ['Drop', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-mg-white-blinder', start: 1, dur: 1 },
      { fx: MID, preset: 'vj-mg-bass-white', start: 2, dur: 3 },
      { fx: FRONT, preset: 'builtin-white', start: 2.5, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 3, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 3.5, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 4, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 4.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 4.75, dur: 0.25 },
      { fx: ALL, preset: 'vj-mg-warm-blinder', start: 5, dur: 1 },
      { fx: MID, preset: 'vj-mg-bass-white', start: 6, dur: 3 },
      { fx: [0, 5], preset: 'builtin-white', start: 6.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 7, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 7.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 8, dur: 0.25 },
      { fx: ALL, preset: 'builtin-white', start: 8.5, dur: 0.25 },
    ],
  },
  // Hands-up warmth: warm-low bed with a gold swell gathering from entry to booth (back, mid, front) and full amber wash on beats 7-8, plus amber glints as pickups; fire when the vocal breakdown lands and hands go up.
  {
    name: 'MG 4 - Golden Hour',
    tags: ['Breakdown', 'Garrix'],
    subdivision: 2,
    clips: [
      { fx: ALL, preset: 'vj-warm-low', start: 1, dur: 8 },
      { fx: BACK, preset: 'vj-gold', start: 1, dur: 2 },
      { fx: [2, 3], preset: 'vj-amber', start: 2.5, dur: 0.5 },
      { fx: MID, preset: 'vj-gold', start: 3, dur: 2 },
      { fx: [0, 5], preset: 'vj-amber', start: 4.5, dur: 0.5 },
      { fx: FRONT, preset: 'vj-gold', start: 5, dur: 2 },
      { fx: MID, preset: 'vj-amber', start: 6.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-amber', start: 7, dur: 2 },
    ],
  },
  // Aggressive snare-roll riser: L/R white wall flips at eighths then sixteenths over an indigo bed, escalating into full strobe with gold pyro strobing the booth, held whiteout on the last half beat; fire on the accelerating roll into the biggest drop.
  {
    name: 'MG 5 - Snare Avalanche',
    tags: ['Buildup', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-indigo-low', start: 1, dur: 4 },
      { fx: LEFT, preset: 'builtin-white', start: 1, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-white', start: 1.5, dur: 0.5 },
      { fx: LEFT, preset: 'builtin-white', start: 2, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-white', start: 2.5, dur: 0.5 },
      { fx: LEFT, preset: 'builtin-white', start: 3, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-white', start: 3.25, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-white', start: 3.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-white', start: 3.75, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-white', start: 4, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-white', start: 4.25, dur: 0.25 },
      { fx: LEFT, preset: 'builtin-white', start: 4.5, dur: 0.25 },
      { fx: RIGHT, preset: 'builtin-white', start: 4.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-med', start: 5, dur: 2 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 7, dur: 1.5 },
      { fx: FRONT, preset: 'vj-mg-gold-strobe', start: 7, dur: 1.5 },
      { fx: ALL, preset: 'vj-mg-white-blinder', start: 8.5, dur: 0.5 },
    ],
  },
  // Festival bounce drop: white pop on each bar's 1, bass-pumped cyan hopping L/R in bar one then magenta hopping the diagonals in bar two, gold quarter ticks at booth then entry, gold strobe roll on the last half beat; fire on bouncy big-room drops.
  {
    name: 'MG 6 - Stadium Bounce',
    tags: ['Drop', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-mg-white-blinder', start: 1, dur: 0.5 },
      { fx: LEFT, preset: 'vj-bass-cyan', start: 1.5, dur: 1 },
      { fx: FRONT, preset: 'vj-gold', start: 2, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-bass-cyan', start: 2.5, dur: 1 },
      { fx: FRONT, preset: 'vj-gold', start: 3, dur: 0.25 },
      { fx: LEFT, preset: 'vj-bass-cyan', start: 3.5, dur: 1 },
      { fx: FRONT, preset: 'vj-gold', start: 4, dur: 0.25 },
      { fx: RIGHT, preset: 'vj-bass-cyan', start: 4.5, dur: 0.5 },
      { fx: ALL, preset: 'vj-mg-white-blinder', start: 5, dur: 0.5 },
      { fx: [0, 5], preset: 'vj-bass-magenta', start: 5.5, dur: 1 },
      { fx: BACK, preset: 'vj-gold', start: 6, dur: 0.25 },
      { fx: [2, 3], preset: 'vj-bass-magenta', start: 6.5, dur: 1 },
      { fx: MID, preset: 'builtin-white', start: 6.5, dur: 0.25 },
      { fx: BACK, preset: 'vj-gold', start: 7, dur: 0.25 },
      { fx: [0, 5], preset: 'vj-bass-magenta', start: 7.5, dur: 1 },
      { fx: MID, preset: 'builtin-white', start: 7.5, dur: 0.25 },
      { fx: BACK, preset: 'vj-gold', start: 8, dur: 0.25 },
      { fx: ALL, preset: 'vj-mg-gold-strobe', start: 8.5, dur: 0.5 },
    ],
  },
  // Dim ember glow at the entry with sparse off-beat red flickers drifting toward the booth - fire during dark menace intros and long mixes.
  {
    name: 'MG 7 - Ember Gate',
    tags: ['Intro', 'Garrix'],
    subdivision: 2,
    clips: [
      { fx: BACK, preset: 'vj-mg-ember-low', start: 1, dur: 8 },
      { fx: [0], preset: 'vj-red-low', start: 2.5, dur: 0.5 },
      { fx: [4], preset: 'vj-red-low', start: 4.5, dur: 0.5 },
      { fx: [1], preset: 'vj-amber-low', start: 6.5, dur: 0.5 },
      { fx: [3], preset: 'vj-red-low', start: 8.5, dur: 0.5 },
    ],
  },
  // White quarter-note chase booth-to-entry with a black pop every beat - utility tunnel, fire any time for instant motion and speed.
  {
    name: 'MG 8 - Warp Tunnel',
    tags: ['FX', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: FRONT, preset: 'builtin-white', start: 1, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 1.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 1.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 2, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 2.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 2.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 3, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 3.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 3.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 4, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 4.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 4.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 5, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 5.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 5.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 6, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 6.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 6.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 7, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 7.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 7.5, dur: 0.25 },
      { fx: FRONT, preset: 'builtin-white', start: 8, dur: 0.25 },
      { fx: MID, preset: 'builtin-white', start: 8.25, dur: 0.25 },
      { fx: BACK, preset: 'builtin-white', start: 8.5, dur: 0.25 },
    ],
  },
  // Red mid bed with off-beat white X-diagonal ticks that accelerate to 16ths in the last bar - loopable tension screw for long builds.
  {
    name: 'MG 9 - Coil',
    tags: ['Buildup', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: MID, preset: 'vj-red-low', start: 1, dur: 8 },
      { fx: [0, 5], preset: 'builtin-white', start: 1.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 2.5, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 3.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 4.5, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 5.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 6.5, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 7.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 7.75, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 8, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 8.25, dur: 0.25 },
      { fx: [0, 5], preset: 'builtin-white', start: 8.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-white', start: 8.75, dur: 0.25 },
    ],
  },
  // Full-rig ramp red-low > amber > slow strobe > fast strobe with widening blackout gasps, ending on half a beat of black - fire on the final 8 before a drop.
  {
    name: 'MG 10 - Gasp Riser',
    tags: ['Buildup', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-red-low', start: 1, dur: 1.75 },
      { fx: ALL, preset: 'vj-amber', start: 3, dur: 1.75 },
      { fx: ALL, preset: 'builtin-strobe-slow', start: 5, dur: 1.5 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 7, dur: 1.5 },
    ],
  },
  // Bass-pumping red on the booth pair while amber off-beat stabs bounce left-right with double-hit skips and a warm blinder slam at the entry - the signature off-beat drop.
  {
    name: 'MG 11 - Animals Bounce',
    tags: ['Drop', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: FRONT, preset: 'vj-mg-bass-red', start: 1, dur: 8 },
      { fx: [1, 2], preset: 'vj-amber', start: 1.5, dur: 0.5 },
      { fx: [4, 5], preset: 'vj-amber', start: 2.5, dur: 0.5 },
      { fx: [1, 2], preset: 'vj-amber', start: 3.5, dur: 0.5 },
      { fx: [4, 5], preset: 'vj-amber', start: 4.5, dur: 0.25 },
      { fx: [1, 2], preset: 'vj-amber', start: 4.75, dur: 0.25 },
      { fx: [4, 5], preset: 'vj-amber', start: 5.5, dur: 0.5 },
      { fx: [1, 2], preset: 'vj-amber', start: 6.5, dur: 0.5 },
      { fx: [4, 5], preset: 'vj-amber', start: 7.5, dur: 0.25 },
      { fx: [1, 2], preset: 'vj-amber', start: 7.75, dur: 0.25 },
      { fx: BACK, preset: 'vj-mg-warm-blinder', start: 8.5, dur: 0.5 },
    ],
  },
  // Left-red versus right-white strobe warfare that halves its trade interval into diagonal 16ths, black pop, then a full-rig white slam - fire on peak-energy drops.
  {
    name: 'MG 12 - Red White War',
    tags: ['Drop', 'Garrix'],
    subdivision: 4,
    clips: [
      { fx: LEFT, preset: 'vj-strobe-red-fast', start: 1, dur: 1 },
      { fx: RIGHT, preset: 'builtin-strobe-fast', start: 2, dur: 1 },
      { fx: LEFT, preset: 'vj-strobe-red-fast', start: 3, dur: 1 },
      { fx: RIGHT, preset: 'builtin-strobe-fast', start: 4, dur: 0.75 },
      { fx: LEFT, preset: 'vj-strobe-red-fast', start: 5, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-strobe-fast', start: 5.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-strobe-red-fast', start: 6, dur: 0.5 },
      { fx: RIGHT, preset: 'builtin-strobe-fast', start: 6.5, dur: 0.5 },
      { fx: [0, 5], preset: 'vj-strobe-red-fast', start: 7, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-strobe-fast', start: 7.25, dur: 0.25 },
      { fx: [0, 5], preset: 'vj-strobe-red-fast', start: 7.5, dur: 0.25 },
      { fx: [2, 3], preset: 'builtin-strobe-fast', start: 7.75, dur: 0.25 },
      { fx: ALL, preset: 'builtin-strobe-fast', start: 8.25, dur: 0.5 },
    ],
  },
  // ═══════════════ TECHNO / MINIMAL (8) - tagged 'Techno' ═══════════════
  // Restraint is the aesthetic: hypnotic repetition, off-beat syncopation,
  // darkness as a design element, single-fixture pointillism, monochrome
  // palettes. Sized for ~122bpm (half-beat ~245ms reads as a clean off-beat
  // hat; quarter pops stay legible, never strobe-spam). No full-rig slams.
  // Deep-red room, warm breaths drifting booth<->entry over the bed - patient opener.
  {
    name: 'TK 1 - Deep Red Room',
    tags: ['Intro', 'Techno'],
    subdivision: 1,
    clips: [
      { fx: ALL, preset: 'vj-red-low', start: 1, dur: 8 },
      { fx: FRONT, preset: 'vj-amber-low', start: 2, dur: 1 },
      { fx: BACK, preset: 'vj-amber-low', start: 4, dur: 1 },
      { fx: FRONT, preset: 'vj-amber-low', start: 6, dur: 1 },
      { fx: BACK, preset: 'vj-amber-low', start: 8, dur: 1 },
    ],
  },
  // Cold warehouse bed with ONE ice pop walking the rig on every off-beat "and".
  {
    name: 'TK 2 - Warehouse Pulse',
    tags: ['Intro', 'Techno'],
    subdivision: 2,
    clips: [
      { fx: ALL, preset: 'vj-ice-low', start: 1, dur: 8 },
      { fx: [0], preset: 'vj-ice', start: 1.5, dur: 0.5 },
      { fx: [4], preset: 'vj-ice', start: 2.5, dur: 0.5 },
      { fx: [2], preset: 'vj-ice', start: 3.5, dur: 0.5 },
      { fx: [3], preset: 'vj-ice', start: 4.5, dur: 0.5 },
      { fx: [1], preset: 'vj-ice', start: 5.5, dur: 0.5 },
      { fx: [5], preset: 'vj-ice', start: 6.5, dur: 0.5 },
      { fx: [0], preset: 'vj-ice', start: 7.5, dur: 0.5 },
      { fx: [4], preset: 'vj-ice', start: 8.5, dur: 0.5 },
    ],
  },
  // Pure syncopation: rig is DARK on every downbeat, teal hits only on the "and"
  // alternating bars L/R - the darkness carries the groove.
  {
    name: 'TK 3 - Off Grid',
    tags: ['FX', 'Techno'],
    subdivision: 2,
    clips: [
      { fx: LEFT, preset: 'vj-teal', start: 1.5, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-teal', start: 2.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-teal', start: 3.5, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-ice', start: 4.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-teal', start: 5.5, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-teal', start: 6.5, dur: 0.5 },
      { fx: LEFT, preset: 'vj-teal', start: 7.5, dur: 0.5 },
      { fx: RIGHT, preset: 'vj-ice', start: 8.5, dur: 0.5 },
    ],
  },
  // One white light circling the rig booth->entry->booth, half-beat steps,
  // everything else black. Minimal pointillism.
  {
    name: 'TK 4 - Monochrome Walk',
    tags: ['FX', 'Techno'],
    subdivision: 2,
    clips: [
      { fx: [0], preset: 'builtin-white', start: 1, dur: 0.5 },
      { fx: [1], preset: 'builtin-white', start: 1.5, dur: 0.5 },
      { fx: [2], preset: 'builtin-white', start: 2, dur: 0.5 },
      { fx: [5], preset: 'builtin-white', start: 2.5, dur: 0.5 },
      { fx: [4], preset: 'builtin-white', start: 3, dur: 0.5 },
      { fx: [3], preset: 'builtin-white', start: 3.5, dur: 0.5 },
      { fx: [0], preset: 'builtin-white', start: 4, dur: 0.5 },
      { fx: [1], preset: 'builtin-white', start: 4.5, dur: 0.5 },
      { fx: [2], preset: 'builtin-white', start: 5, dur: 0.5 },
      { fx: [5], preset: 'builtin-white', start: 5.5, dur: 0.5 },
      { fx: [4], preset: 'builtin-white', start: 6, dur: 0.5 },
      { fx: [3], preset: 'builtin-white', start: 6.5, dur: 0.5 },
      { fx: [0], preset: 'builtin-white', start: 7, dur: 0.5 },
      { fx: [1], preset: 'builtin-white', start: 7.5, dur: 0.5 },
      { fx: [2], preset: 'builtin-white', start: 8, dur: 0.5 },
      { fx: [5], preset: 'builtin-white', start: 8.5, dur: 0.5 },
    ],
  },
  // Acid tension loop: green bass-pump on the mids, sparse green off-beat pops
  // that double in density in bar 2, half-beat all-green lift at the end.
  {
    name: 'TK 5 - Acid Line',
    tags: ['Buildup', 'Techno'],
    subdivision: 2,
    clips: [
      { fx: MID, preset: 'vj-bass-green', start: 1, dur: 8 },
      { fx: [0], preset: 'builtin-green', start: 1.5, dur: 0.5 },
      { fx: [3], preset: 'builtin-green', start: 3.5, dur: 0.5 },
      { fx: [0], preset: 'builtin-green', start: 5.5, dur: 0.5 },
      { fx: [3], preset: 'builtin-green', start: 6.5, dur: 0.5 },
      { fx: [0, 3], preset: 'builtin-green', start: 7.5, dur: 0.5 },
      { fx: ALL, preset: 'builtin-green', start: 8.5, dur: 0.5 },
    ],
  },
  // Groove section: bass-pumped cyan rolling booth<->entry one row per beat,
  // countered by lone ice quarter-pops on the off rows.
  {
    name: 'TK 6 - Rolling Bass',
    tags: ['Drop', 'Techno'],
    subdivision: 2,
    clips: [
      { fx: FRONT, preset: 'vj-bass-cyan', start: 1, dur: 1 },
      { fx: MID, preset: 'vj-bass-cyan', start: 2, dur: 1 },
      { fx: BACK, preset: 'vj-bass-cyan', start: 3, dur: 1 },
      { fx: MID, preset: 'vj-bass-cyan', start: 4, dur: 1 },
      { fx: FRONT, preset: 'vj-bass-cyan', start: 5, dur: 1 },
      { fx: MID, preset: 'vj-bass-cyan', start: 6, dur: 1 },
      { fx: BACK, preset: 'vj-bass-cyan', start: 7, dur: 1 },
      { fx: MID, preset: 'vj-bass-cyan', start: 8, dur: 1 },
      { fx: [5], preset: 'vj-ice', start: 2.5, dur: 0.25 },
      { fx: [0], preset: 'vj-ice', start: 4.5, dur: 0.25 },
      { fx: [3], preset: 'vj-ice', start: 6.5, dur: 0.25 },
      { fx: [2], preset: 'vj-ice', start: 8.5, dur: 0.25 },
    ],
  },
  // Whispered accents: dark red bed, single white micro-pops landing on the
  // "a" (x.75) rotating through the rig - tension without a single strobe.
  {
    name: 'TK 7 - Strobe Whisper',
    tags: ['Drop', 'Techno'],
    subdivision: 4,
    clips: [
      { fx: ALL, preset: 'vj-red-low', start: 1, dur: 8 },
      { fx: [4], preset: 'builtin-white', start: 1.75, dur: 0.25 },
      { fx: [1], preset: 'builtin-white', start: 2.75, dur: 0.25 },
      { fx: [5], preset: 'builtin-white', start: 3.75, dur: 0.25 },
      { fx: [0], preset: 'builtin-white', start: 4.75, dur: 0.25 },
      { fx: [3], preset: 'builtin-white', start: 5.75, dur: 0.25 },
      { fx: [2], preset: 'builtin-white', start: 6.75, dur: 0.25 },
      { fx: [4], preset: 'builtin-white', start: 7.75, dur: 0.25 },
      { fx: [1], preset: 'builtin-white', start: 8.75, dur: 0.25 },
    ],
  },
  // Cooldown: cool pairs rotating slowly around the rig, two beats each.
  {
    name: 'TK 8 - Fade Circle',
    tags: ['Breakdown', 'Techno'],
    subdivision: 1,
    clips: [
      { fx: FRONT, preset: 'vj-teal-low', start: 1, dur: 2 },
      { fx: MID, preset: 'vj-blue-low', start: 3, dur: 2 },
      { fx: BACK, preset: 'vj-teal-low', start: 5, dur: 2 },
      { fx: ALL, preset: 'vj-blue-low', start: 7, dur: 2 },
    ],
  },
]

// Names are the idempotency key: re-loading the pack refreshes these sets
// instead of duplicating them.
export const VJ_SET_NAMES: string[] = VJ_SET_SPECS.map(s => s.name)

// Names from earlier pack versions, removed on reload so an upgrade doesn't
// leave orphaned duplicates behind.
export const LEGACY_VJ_SET_NAMES: string[] = [
  '1 - Deep Pulse', '2 - Amber Horizon', '3 - Riser Sweep',
  '4 - Color Climb', '5 - Strobe Slam', '6 - Bounce Groove',
]

// ═══════════════════════════════════════════════════════════════
// COMPILER: spec + live fixture ids -> ready-to-add Sets
// ═══════════════════════════════════════════════════════════════
// `fixtureDeviceIds` are the user's pinspot device ids in venue order
// (fixture 1..6). `makeId` is injectable so tests can be deterministic.
export function buildVjSetPack(
  fixtureDeviceIds: string[],
  makeId: () => string = generateId,
): Array<Omit<Set, 'id'>> {
  const n = Math.min(fixtureDeviceIds.length, 6)

  return VJ_SET_SPECS.map(spec => {
    // One track per available fixture, in venue order.
    const trackIdByFx: string[] = []
    const tracks: SetTrack[] = []
    for (let i = 0; i < n; i++) {
      const id = makeId()
      trackIdByFx[i] = id
      tracks.push({
        id,
        name: TRACK_META[i]!.name,
        targetType: 'device',
        targetId: fixtureDeviceIds[i]!,
        color: TRACK_META[i]!.color,
        muted: false,
        solo: false,
      })
    }

    const clips: SetClip[] = []
    for (const c of spec.clips) {
      for (const fx of c.fx) {
        if (fx >= n) continue // fixture not present in this rig -> skip
        clips.push({
          id: makeId(),
          trackId: trackIdByFx[fx]!,
          presetId: c.preset,
          startBeat: c.start,
          duration: c.dur,
        })
      }
    }

    return {
      name: spec.name,
      length: 8 as SetLength,
      subdivision: spec.subdivision,
      tags: [...spec.tags],
      tracks,
      clips,
    }
  })
}
