// Pure math for FX pads: sets wired to controller buttons that overlay the
// playing base set while held. All positions are ABSOLUTE global steps in
// beats (fractional, 1/4 resolution), where step 0 is the anchored downbeat
// ("1"). Framework-free so vitest can verify the launch/release rules.

const EPS = 1e-9

// A press landing inside the first quarter of a beat joins the boundary it just
// missed (performers press late, not early). Strict `<` so a stepped internal
// clock (1/4 ticks) grants exactly one tick of grace, not two.
export const LATE_GRACE = 0.25

// Launch quantize: 'length' = phase-locked to the global grid (the pad plays
// whatever step the metronome is at, mod its length). A number q = the pad
// restarts from ITS step 1 on the next multiple of q beats.
export type PadQuantize = number | 'length'

export interface PadConfig {
  setId: string
  quantize: PadQuantize      // launch quantize in beats (1|2|4|8...) or 'length'
  releaseQuantize: number    // release snaps UP to this global grid (0.25|0.5|1)
  minHoldBeats: number       // plays at least this long even on an instant tap
}

export interface ActivePad {
  setId: string
  anchorStep: number         // global step where the pad's step 1 aligns (0 for 'length')
  visibleFrom: number        // global step the overlay becomes audible
  releaseAt: number | null   // global step the overlay ends (null = still held)
}

// Global step of the boundary a press at `nowStep` launches on: the previous
// multiple of `quantizeBeats` if within grace, else the next one.
export function resolveLaunchStep(nowStep: number, quantizeBeats: number): number {
  const q = Math.max(LATE_GRACE, quantizeBeats)
  const prev = Math.floor(nowStep / q + EPS) * q
  if (nowStep - prev < LATE_GRACE) return prev
  return prev + q
}

// 1-indexed fractional step within the pad's set, or 0 if the pad has not
// launched yet (anchor still in the future).
export function padLocalStep(globalStep: number, anchorStep: number, padLength: number): number {
  const rel = globalStep - anchorStep
  if (rel < -EPS) return 0
  const len = Math.max(1, padLength)
  return (((rel % len) + len) % len) + 1
}

// Global step the pad stops at: never before `audibleFrom + minHoldBeats`,
// snapped UP to the next multiple of `releaseQuantize`.
export function resolveReleaseStep(
  nowStep: number,
  audibleFrom: number,
  releaseQuantize: number,
  minHoldBeats: number,
): number {
  const rq = Math.max(0.25, releaseQuantize)
  const target = Math.max(nowStep, audibleFrom + Math.max(0, minHoldBeats))
  return Math.ceil(target / rq - EPS) * rq
}

export function padFinished(pad: ActivePad, nowStep: number): boolean {
  return pad.releaseAt !== null && nowStep >= pad.releaseAt - EPS
}

export function padAudible(pad: ActivePad, nowStep: number): boolean {
  return nowStep >= pad.visibleFrom - EPS && !padFinished(pad, nowStep)
}

export function buildActivePad(cfg: PadConfig, nowStep: number): ActivePad {
  if (cfg.quantize === 'length') {
    // Phase-locked: step 1 is pinned to the global downbeat; the overlay itself
    // still appears beat-quantized so entry lands musically.
    return { setId: cfg.setId, anchorStep: 0, visibleFrom: resolveLaunchStep(nowStep, 1), releaseAt: null }
  }
  const anchor = resolveLaunchStep(nowStep, cfg.quantize)
  return { setId: cfg.setId, anchorStep: anchor, visibleFrom: anchor, releaseAt: null }
}

// ── Frame overlay ───────────────────────────────────────────────────────────
// A pad replaces the base frame ONLY on the channel spans its set actively
// claims at this step (a clip present = opaque, even a painted-black one;
// no clip = the base shows through).
export interface ChannelSpan {
  start: number  // 0-based DMX index of the device's ch0
  count: number
}

export function overlayFrame(base: number[], fx: number[], spans: ChannelSpan[]): number[] {
  if (spans.length === 0) return base
  const out = [...base]
  for (const s of spans) {
    for (let i = 0; i < s.count; i++) {
      const idx = s.start + i
      if (idx >= 0 && idx < out.length) out[idx] = fx[idx] ?? 0
    }
  }
  return out
}
