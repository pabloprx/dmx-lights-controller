// Pure DMX-frame override math for the live "performance layer": momentary
// blinder / blackout (RB/LB) and analog-stick FX (L/R balance, color tint).
// Kept framework-free so the player can compose them and vitest can verify them.
//
// A FixtureSlot is a flattened view of a device for frame math: where its ch0
// lives, whether it's an RGBW pinspot, how many channels, and which side of the
// rig it belongs to (first half = Left, second half = Right).

export interface FixtureSlot {
  idx: number          // 0-based DMX index of channel 0 (startChannel - 1)
  rgbw: boolean        // profile.controlType === 'rgbw'
  channelCount: number
  side: 'L' | 'R'
}

// Build slots from a device list + a profile resolver. Left = first half.
export function buildSlots(
  devices: { startChannel: number; profileId: string }[],
  getControl: (profileId: string) => { controlType?: string; channelCount?: number } | null,
): FixtureSlot[] {
  const half = Math.ceil(devices.length / 2)
  return devices.map((d, i) => {
    const p = getControl(d.profileId)
    return {
      idx: d.startChannel - 1,
      rgbw: p?.controlType === 'rgbw',
      channelCount: p?.channelCount ?? 5,
      side: i < half ? 'L' : 'R',
    }
  })
}

export function splitLeftRight<T>(devices: T[]): { left: T[]; right: T[] } {
  const half = Math.ceil(devices.length / 2)
  return { left: devices.slice(0, half), right: devices.slice(half) }
}

// HSV(h,1,1) -> RGB 0..255. hue01 in 0..1 (wraps).
export function hueToRgb(hue01: number): [number, number, number] {
  const h = (((hue01 % 1) + 1) % 1) * 6
  const c = 255
  const x = c * (1 - Math.abs((h % 2) - 1))
  let r = 0, g = 0, b = 0
  if (h < 1) { r = c; g = x; b = 0 }
  else if (h < 2) { r = x; g = c; b = 0 }
  else if (h < 3) { r = 0; g = c; b = x }
  else if (h < 4) { r = 0; g = x; b = c }
  else if (h < 5) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return [Math.round(r), Math.round(g), Math.round(b)]
}

// 0 = full left, 0.5 = even, 1 = full right. Each side stays at full until past
// center, then the opposite side fades to 0 (a crossfade/pan).
export function lrBalanceGains(value01: number): { left: number; right: number } {
  const v = Math.max(0, Math.min(1, value01))
  return { left: Math.min(1, 2 * (1 - v)), right: Math.min(1, 2 * v) }
}

// L/R balance: dim the side the gains say to dim. We scale the COLOR channels
// (RGBW), not ch0 - because for these pinspots the rendered/emitted brightness is
// rgb*intensity, so scaling the color is a uniform, COLOUR-INDEPENDENT dim that
// works whatever band ch0 is in (dimmer/full/strobe). Neutral (gain 1) untouched.
export function applyBalanceToFrame(channels: number[], slots: FixtureSlot[], gains: { left: number; right: number }): number[] {
  const out = [...channels]
  for (const s of slots) {
    const scale = s.side === 'L' ? gains.left : gains.right
    if (scale >= 0.999) continue
    const i = s.idx
    if (s.rgbw) {
      for (let o = 1; o <= 4; o++) if (i + o < out.length) out[i + o] = Math.round(out[i + o]! * scale)
    } else {
      for (let o = 0; o < s.channelCount; o++) if (i + o < out.length) out[i + o] = Math.round(out[i + o]! * scale)
    }
  }
  return out
}

// Color wash: bathe the WHOLE rig in a hue. Lerps each RGBW fixture's RGB toward
// the hue, fades its white so the colour reads cleanly, AND raises ch0 on dark
// fixtures so the wash actually lights them up (not just the ones already playing).
// ch0 lift stays in the dimmer band (9-134) so it never trips the strobe band.
export function applyTintToFrame(channels: number[], slots: FixtureSlot[], hue01: number, amount01: number): number[] {
  const a = Math.max(0, Math.min(1, amount01))
  if (a <= 0) return channels
  const [tr, tg, tb] = hueToRgb(hue01)
  const litCh0 = Math.round(9 + a * 125) // dimmer-band intensity proportional to wash amount
  const out = [...channels]
  for (const s of slots) {
    if (!s.rgbw) continue
    const i = s.idx
    if (i + 3 >= out.length) continue
    out[i + 1] = Math.round(out[i + 1]! * (1 - a) + tr * a)
    out[i + 2] = Math.round(out[i + 2]! * (1 - a) + tg * a)
    out[i + 3] = Math.round(out[i + 3]! * (1 - a) + tb * a)
    if (i + 4 < out.length) out[i + 4] = Math.round(out[i + 4]! * (1 - a)) // fade white toward the hue
    // Light up dark fixtures so the wash covers the whole rig. Never lowers an
    // already-brighter level, and never touches strobe(135-239)/full(240+) since litCh0<=134.
    if (out[i]! < litCh0) out[i] = litCh0
  }
  return out
}

// Audience blinder: force every RGBW fixture to full white at `level01`.
export function applyBlinderToFrame(channels: number[], slots: FixtureSlot[], level01: number): number[] {
  const out = [...channels]
  const v = Math.round(Math.max(0, Math.min(1, level01)) * 255)
  for (const s of slots) {
    if (!s.rgbw) continue
    const i = s.idx
    if (i < 0 || i >= out.length) continue
    out[i] = 255 // full intensity band
    if (i + 1 < out.length) out[i + 1] = v
    if (i + 2 < out.length) out[i + 2] = v
    if (i + 3 < out.length) out[i + 3] = v
    if (s.channelCount >= 5 && i + 4 < out.length) out[i + 4] = v
  }
  return out
}

// Blackout hold: everything off.
export function applyBlackoutToFrame(channels: number[]): number[] {
  return new Array(channels.length).fill(0)
}
