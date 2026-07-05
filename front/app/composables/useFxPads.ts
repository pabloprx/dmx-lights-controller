// ═══════════════════════════════════════════════════════════════
// FX PADS - sets wired to controller buttons, overlaid on the base set while
// held. Press/release rules (quantized launch, late-press grace, min-hold,
// quantized release) live in lib/padMath.ts; this composable owns the live
// pad stack and the per-frame compositing hook the player calls.
//
// Import direction: useSetPlayer imports THIS; this must never import the
// player (it only needs the clock sources + the store).
// ═══════════════════════════════════════════════════════════════

import { useAbletonLink } from './useAbletonLink'
import { useAppMode } from './useAppMode'
import { useDMXStore } from './useDMXStore'
import { PLAYBACK_STEPS } from '~/lib/beatMath'
import {
  buildActivePad, padLocalStep, padAudible, padFinished, resolveReleaseStep, overlayFrame,
  type ActivePad, type PadConfig,
} from '~/lib/padMath'

// Live pad stack in PRESS ORDER - later presses composite on top (latest wins
// per fixture). Singleton so every consumer sees the same performance state.
const activePads = ref<ActivePad[]>([])

export function useFxPads() {
  const link = useAbletonLink()
  const appMode = useAppMode()
  const store = useDMXStore()

  // Absolute global step in beats (fractional), quantized to the fixed playback
  // resolution. Step 0 = the anchored downbeat (resyncBeat / Link session start),
  // so quantize boundaries are "musical" multiples of it.
  const globalStepFloat = computed(() => {
    const raw = link.connected.value
      ? Math.floor(link.state.value.beat) + (link.state.value.phase % 1)
      : appMode.internalBeatFloat.value
    return Math.floor(raw * PLAYBACK_STEPS) / PLAYBACK_STEPS
  })

  const activeCount = computed(() => activePads.value.length)

  function isPadHeld(setId: string): boolean {
    return activePads.value.some(p => p.setId === setId && p.releaseAt === null)
  }

  // Press: (re)arm the pad and move it to the top of the stack. Re-pressing a
  // pad that is still sounding re-anchors it (a re-stab), never silently no-ops.
  function press(cfg: PadConfig) {
    const pad = buildActivePad(cfg, globalStepFloat.value)
    activePads.value = [...activePads.value.filter(p => p.setId !== cfg.setId), pad]
  }

  // Release: schedule the stop on the release grid, honouring min-hold.
  // `immediate` (clock not running) drops the pad right away so a frozen
  // metronome can never leave an overlay stuck on.
  function release(setId: string, releaseQuantize: number, minHoldBeats: number, immediate = false) {
    if (immediate) {
      activePads.value = activePads.value.filter(p => p.setId !== setId)
      return
    }
    const now = globalStepFloat.value
    activePads.value = activePads.value.map(p =>
      p.setId === setId && p.releaseAt === null
        ? { ...p, releaseAt: resolveReleaseStep(now, p.visibleFrom, releaseQuantize, minHoldBeats) }
        : p,
    )
  }

  function clearAll() {
    activePads.value = []
  }

  // Composite every audible pad over `channels` (base frame) at the CURRENT
  // global step. Also prunes pads whose scheduled release has passed.
  function applyToFrame(channels: number[]): number[] {
    if (activePads.value.length === 0) return channels
    const now = globalStepFloat.value

    const alive = activePads.value.filter(p => !padFinished(p, now))
    if (alive.length !== activePads.value.length) activePads.value = alive
    if (alive.length === 0) return channels

    let out = channels
    for (const pad of alive) {
      if (!padAudible(pad, now)) continue // launch scheduled but not reached yet
      const set = store.sets.value.find(s => s.id === pad.setId)
      if (!set) continue
      const local = padLocalStep(now, pad.anchorStep, set.length)
      if (local < 1) continue
      const fx = store.getSetDMX(set, local).slice(0, channels.length)
      const spans = store.getSetActiveSpans(set, local)
      out = overlayFrame(out, fx, spans)
    }
    return out
  }

  return {
    activePads: readonly(activePads),
    activeCount,
    globalStepFloat,
    isPadHeld,
    press,
    release,
    clearAll,
    applyToFrame,
  }
}
