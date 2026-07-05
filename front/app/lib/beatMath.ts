// Pure beat-position math for the set player, extracted for unit testing.
// mirrors app/composables/useSetPlayer.ts:74-96 (beatInSet computed)

export interface BeatInSetParams {
  linkConnected: boolean
  // Ableton Link bar-aware fields (only used when linkConnected)
  barNumber: number
  beatInBar: number
  quantum: number
  // Internal tempo fields
  currentBeat: number
  setLength: number
  loopEnabled: boolean
}

// Returns the 1-indexed beat within the set.
// mirrors useSetPlayer.ts:74-96
export function computeBeatInSet(p: BeatInSetParams): number {
  // When Link is connected, use bar-aware calculation
  if (p.linkConnected) {
    // Calculate how many bars fit in this set
    const barsInSet = Math.ceil(p.setLength / p.quantum)
    // Which bar within the set are we in? (0-indexed)
    const barInSet = p.barNumber % barsInSet
    // Calculate absolute beat position: (bar * quantum) + beatInBar
    const absoluteBeat = barInSet * p.quantum + p.beatInBar
    // Clamp to set length (in case set isn't exactly divisible by quantum)
    return Math.min(absoluteBeat, p.setLength)
  }

  // Internal tempo mode: simple modulo
  if (p.loopEnabled) {
    return ((p.currentBeat - 1) % p.setLength) + 1
  }
  return Math.min(p.currentBeat, p.setLength)
}

// ── Sub-beat (grid subdivision) ────────────────────────────────────────────
// The PENCIL resolution: cells-per-beat you draw/snap at. 1 (beats), 2 (1/2),
// 4 (1/4). It is an editor setting ONLY - it never rewrites clips. Total cells
// (length*sub) is capped at 32 so a long set can't blow the grid up.
const ALLOWED_SUBDIVISIONS = [1, 2, 4]
export function clampSubdivision(setLength: number, subdivision: number | undefined): number {
  const raw = Math.max(1, Math.round(subdivision ?? 1))
  // snap to the largest allowed value <= raw
  let s = 1
  for (const a of ALLOWED_SUBDIVISIONS) if (a <= raw) s = a
  // step down until length*s fits the 32-cell cap
  while (s > 1 && setLength * s > 32) {
    s = ALLOWED_SUBDIVISIONS[ALLOWED_SUBDIVISIONS.indexOf(s) - 1]!
  }
  return s
}

// Playback ALWAYS samples at this resolution (1/4-beat), independent of the
// per-set pencil, so any clip down to a 1/4 note triggers in sync. Must be >=
// the finest pencil; the internal clock (useAppMode MAX_SUB) matches it.
export const PLAYBACK_STEPS = 4

export interface StepInSetParams {
  linkConnected: boolean
  linkPhase: number          // Link phase = getPhase(quantum), BAR-phase [0,quantum). Use %1 for intra-beat.
  internalBeatFloat: number  // fractional beat counter from the internal-tempo clock
  beatInSet: number          // integer 1-indexed beat within the set (from computeBeatInSet)
  subdivision: number        // steps per beat (>=1)
}

// ── Reverse playback (momentary, e.g. L3 held) ─────────────────────────────
// Mirrors a position inside the set window so the clock keeps running forward
// while the SAMPLED position runs last-to-first. Pure: mirror twice = identity.

// Integer beat mirror: beat 1 <-> length (for displays / whole-beat consumers).
export function mirrorBeat(beat: number, length: number): number {
  return length + 1 - beat
}

// Fractional step mirror on the playback grid. Steps live on
// {1, 1+s, ..., length+1-s} with s = 1/stepsPerBeat; the mirror swaps the
// first and last step, so floor(mirrorStep(x)) === mirrorBeat(floor(x)).
// (Kept for the "phase-locked mirror" reverse variant - currently unused; the
// live behavior is reverseFromEnd below, which restarts from the END on press.)
export function mirrorStep(step: number, length: number, stepsPerBeat: number): number {
  const s = 1 / Math.max(1, Math.round(stepsPerBeat))
  return length + 2 - s - step
}

// Anchored reverse ("restart reversed") - VARIANT B, kept for rollback: on
// press we snapshot the forward step (anchor); the sampled position STARTS at
// the set's last step and walks backward, looping end -> 1 -> end.
export function reverseFromEnd(
  forwardStep: number,
  anchorStep: number,
  length: number,
  stepsPerBeat: number,
): number {
  const s = 1 / Math.max(1, Math.round(stepsPerBeat))
  // steps elapsed since the press, wrapped onto the loop [0, length)
  const elapsed = (((forwardStep - anchorStep) % length) + length) % length
  const pos = length + 1 - s - elapsed
  return pos < 1 ? pos + length : pos
}

// ── VARIANT C (LIVE): reverse from HERE, both edges beat-quantized ──────────
// Hold: at the NEXT whole beat the position stops advancing and walks backward
// from exactly where it is (seamless: reversed pos == forward pos at the
// boundary), looping ... 2 -> 1 -> length -> ... Release: at the next whole
// beat the position snaps back to the forward synced clock (which never
// stopped underneath). Nothing ever changes mid-beat - "on time, not on click".

export interface ReverseHereState {
  engageAbs: number           // whole-beat absolute-clock value where reverse engages
  engagePos: number           // 1-indexed in-set position at engageAbs
  disengageAbs: number | null // set on release: boundary where forward resumes
}

// Next whole-beat boundary at-or-after absFloat. Pressing exactly ON the beat
// engages on that beat (epsilon guards float dust from the quarter grid).
export function nextBeatBoundary(absFloat: number): number {
  return Math.ceil(absFloat - 1e-9)
}

// Wrap a 1-indexed position into [1, length+1).
export function wrapPos(pos: number, length: number): number {
  return ((pos - 1) % length + length) % length + 1
}

export function armReverseHere(absFloat: number, forwardStep: number, length: number): ReverseHereState {
  const engageAbs = nextBeatBoundary(absFloat)
  return {
    engageAbs,
    // forward advances 1:1 with the clock, so project it to the boundary
    engagePos: wrapPos(forwardStep + (engageAbs - absFloat), length),
    disengageAbs: null,
  }
}

// Release: forward resumes at the next boundary. Clamped to engageAbs so a
// tap shorter than the arm window is a clean no-op (never a mid-beat blip).
export function releaseReverseHere(st: ReverseHereState, absFloat: number): ReverseHereState {
  return { ...st, disengageAbs: Math.max(nextBeatBoundary(absFloat), st.engageAbs) }
}

// Sample the position for a given clock value: forward before engage / after
// disengage, reversed walk in between.
export function sampleReverseHere(
  st: ReverseHereState,
  absFloat: number,
  forwardStep: number,
  length: number,
): { pos: number; reversed: boolean } {
  if (absFloat < st.engageAbs) return { pos: forwardStep, reversed: false }
  if (st.disengageAbs !== null && absFloat >= st.disengageAbs) return { pos: forwardStep, reversed: false }
  return { pos: wrapPos(st.engagePos - (absFloat - st.engageAbs), length), reversed: true }
}

// 1-indexed fractional position within the set, quantized to the subdivision.
// e.g. subdivision 2, second half of beat 1 -> 1.5. When subdivision <= 1 this
// is exactly beatInSet (so behaviour is identical to before = backward compatible).
export function computeStepInSet(p: StepInSetParams): number {
  const sub = Math.max(1, Math.round(p.subdivision))
  if (sub <= 1) return p.beatInSet
  // intra-beat fraction 0..1 (Link phase is bar-phase, so take %1)
  const fracRaw = (p.linkConnected ? p.linkPhase : p.internalBeatFloat) % 1
  const frac = Math.floor(fracRaw * sub) / sub
  return p.beatInSet + frac
}
