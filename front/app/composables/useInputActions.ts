// ═══════════════════════════════════════════════════════════════
// INPUT ACTIONS - source-agnostic action dispatcher
// Both MIDI (useMIDIMapper) and Gamepad (useGamepadMapper) call dispatchAction.
// Contract: `value01` is ALWAYS normalized 0..1 (button pressed = 1, released = 0,
// analog trigger/stick = its position). No source ever passes raw 0-127 here.
// ═══════════════════════════════════════════════════════════════

import { useSetPlayer, manualStrobe, manualBlinder, manualHold, lrBalance, colorTint } from './useSetPlayer'
import { useAppMode } from './useAppMode'
import { useDMXStore } from './useDMXStore'
import { usePerformNav } from './usePerformNav'
import { useFxPads } from './useFxPads'
import type { PadQuantize } from '~/lib/padMath'

export type InputActionType =
  | 'master:dimmer'           // analog -> 0-100% master dimmer (smoothed)
  | 'master:dimmer-reset'     // button -> snap master dimmer to 100%
  | 'master:blackout'         // button -> toggle blackout
  | 'master:strobe-momentary' // hold -> strobe all fixtures; pressure -> speed
  | 'override:blinder-hold'   // hold -> audience blinder (all white/full)
  | 'override:blackout-hold'  // hold -> momentary blackout (kill output while held)
  | 'fx:lr-balance'           // analog -> pan intensity across Left/Right bars
  | 'fx:color-tint-hue'       // analog -> hue of the live color wash
  | 'fx:color-tint-amount'    // analog -> amount of the live color wash
  | 'transport:play'          // button -> play/pause toggle
  | 'transport:stop'          // button -> stop
  | 'transport:tap'           // button -> tap tempo
  | 'transport:beat-sync'     // button -> re-align beat to "1" on the downbeat
  | 'set:next'                // button -> select next set (within current section)
  | 'set:prev'                // button -> select prev set (within current section)
  | 'set:section-next'        // button -> next section filter (Intro/Buildup/Drop/FX...)
  | 'set:section-prev'        // button -> prev section filter
  | 'set:activate'            // button -> make selected set active
  | 'set:trigger'             // button -> activate selected set AND play
  | 'set:direct'              // button -> activate a specific set by id
  | 'set:index'              // button -> activate the Nth set by position
  | 'pad:fx'                  // hold -> overlay a set on the base (quantized launch/release)
  | 'playback:reverse-hold'   // hold -> play the active set last-to-first (mirrored sampling)
  | 'input:mode-toggle'       // button -> toggle Testing/Performance

export interface InputAction {
  type: InputActionType
  setId?: string
  setIndex?: number
  invert?: boolean   // analog only: flip 0..1 (spring trigger -> rest = full, squeeze = 0)
  // pad:fx only - launch/release rules (see lib/padMath.ts)
  quantize?: PadQuantize      // launch quantize in beats, or 'length' = global phase-lock
  releaseQuantize?: number    // release snaps up to this grid (beats)
  minHold?: number            // minimum beats played even on an instant tap
}

// Human-readable catalog used by the config UIs (label + whether it wants an analog control)
export const ACTION_CATALOG: { type: InputActionType; label: string; analog: boolean; needsSet?: boolean }[] = [
  { type: 'master:dimmer', label: 'Master Dimmer', analog: true },
  { type: 'master:dimmer-reset', label: 'Reset Dimmer to 100%', analog: false },
  { type: 'master:blackout', label: 'Blackout (toggle)', analog: false },
  { type: 'master:strobe-momentary', label: 'Strobe (hold)', analog: true },
  { type: 'override:blinder-hold', label: 'Blinder (hold)', analog: false },
  { type: 'override:blackout-hold', label: 'Blackout (hold)', analog: false },
  { type: 'fx:lr-balance', label: 'L/R Balance (stick)', analog: true },
  { type: 'fx:color-tint-hue', label: 'Color Tint Hue (stick)', analog: true },
  { type: 'fx:color-tint-amount', label: 'Color Tint Amount (stick)', analog: true },
  { type: 'transport:play', label: 'Play / Pause', analog: false },
  { type: 'transport:stop', label: 'Stop', analog: false },
  { type: 'transport:tap', label: 'Tap Tempo', analog: false },
  { type: 'transport:beat-sync', label: 'Beat Sync (re-downbeat)', analog: false },
  { type: 'set:next', label: 'Next Set', analog: false },
  { type: 'set:prev', label: 'Previous Set', analog: false },
  { type: 'set:section-next', label: 'Next Section (Intro/Drop...)', analog: false },
  { type: 'set:section-prev', label: 'Prev Section (Intro/Drop...)', analog: false },
  { type: 'set:activate', label: 'Activate Selected Set', analog: false },
  { type: 'set:trigger', label: 'Trigger Set (activate + play)', analog: false },
  { type: 'set:direct', label: 'Go To Set...', analog: false, needsSet: true },
  { type: 'set:index', label: 'Go To Set #N', analog: false },
  { type: 'pad:fx', label: 'FX Pad (hold to overlay set)', analog: false, needsSet: true },
  { type: 'playback:reverse-hold', label: 'Reverse Play (hold)', analog: false },
  { type: 'input:mode-toggle', label: 'Toggle Testing/Performance', analog: false },
]

// Smooth dimmer interpolation (shared by all input sources)
let dimmerTarget = 100
let dimmerCurrent = 100
let dimmerAnimationFrame: number | null = null
const DIMMER_SMOOTHING = 0.85 // higher = snappier

function smoothDimmer(player: ReturnType<typeof useSetPlayer>) {
  if (dimmerAnimationFrame) cancelAnimationFrame(dimmerAnimationFrame)
  function animate() {
    const diff = dimmerTarget - dimmerCurrent
    if (Math.abs(diff) < 0.5) {
      dimmerCurrent = dimmerTarget
      player.setMasterDimmer(Math.round(dimmerCurrent))
      dimmerAnimationFrame = null
      return
    }
    dimmerCurrent += diff * DIMMER_SMOOTHING
    player.setMasterDimmer(Math.round(dimmerCurrent))
    dimmerAnimationFrame = requestAnimationFrame(animate)
  }
  dimmerAnimationFrame = requestAnimationFrame(animate)
}

export function useInputActions() {
  const player = useSetPlayer()
  const appMode = useAppMode()
  const store = useDMXStore()
  const perform = usePerformNav()
  const fxPads = useFxPads()

  // Navigate within the CURRENT section filter (so up/down picks the section,
  // left/right scrolls the sets inside it). Falls back to all sets.
  function nextSet() {
    const list = perform.visibleSets.value
    if (list.length === 0) return
    const currentId = store.selectedSet.value?.id
    const idx = currentId ? list.findIndex(s => s.id === currentId) : -1
    const next = list[(idx + 1) % list.length]
    if (next) store.selectSet(next.id)
  }

  function prevSet() {
    const list = perform.visibleSets.value
    if (list.length === 0) return
    const currentId = store.selectedSet.value?.id
    const idx = currentId ? list.findIndex(s => s.id === currentId) : 0
    const prev = list[idx <= 0 ? list.length - 1 : idx - 1]
    if (prev) store.selectSet(prev.id)
  }

  function togglePlay() {
    if (player.isPlaying.value) {
      player.stop()
      if (appMode.isTestingMode.value && appMode.internalPlaying.value) appMode.toggleInternalPlayback()
    } else {
      player.play()
      if (appMode.isTestingMode.value && !appMode.internalPlaying.value) appMode.toggleInternalPlayback()
    }
  }

  // The single executor. value01 is normalized 0..1.
  function dispatchAction(action: InputAction, value01: number) {
    const pressed = value01 > 0.001

    switch (action.type) {
      case 'master:dimmer': {
        // invert -> spring trigger rests at 100% and dims to 0% as you squeeze.
        const v = action.invert ? 1 - value01 : value01
        dimmerTarget = Math.round(v * 100)
        smoothDimmer(player)
        break
      }

      case 'master:dimmer-reset':
        if (pressed) {
          dimmerTarget = 100
          dimmerCurrent = 100
          player.setMasterDimmer(100)
        }
        break

      case 'master:blackout':
        if (pressed) appMode.toggleBlackout()
        break

      case 'master:strobe-momentary': {
        // Hold to strobe everything; analog pressure controls speed.
        const active = value01 > 0.15
        manualStrobe.value = { active, speed01: active ? Math.max(0.1, value01) : manualStrobe.value.speed01 }
        player.updateDMX() // force an immediate frame so hardware + visualizer react now
        break
      }

      case 'override:blinder-hold':
        manualBlinder.value = { active: pressed, level01: 1 }
        player.updateDMX()
        break

      case 'override:blackout-hold':
        manualHold.value = { blackout: pressed }
        player.updateDMX()
        break

      case 'fx:lr-balance': {
        // Stick X: center (0.5) = even. Small deadzone so a resting stick is neutral.
        lrBalance.value = Math.abs(value01 - 0.5) < 0.06 ? 0.5 : value01
        player.updateDMX()
        break
      }

      case 'fx:color-tint-hue':
        colorTint.value = { ...colorTint.value, hue01: value01 }
        player.updateDMX()
        break

      case 'fx:color-tint-amount': {
        // Stick Y: center = no wash; push either way increases the wash amount.
        const amt = Math.abs(value01 - 0.5) < 0.06 ? 0 : Math.abs(value01 - 0.5) * 2
        colorTint.value = { ...colorTint.value, amount01: amt }
        player.updateDMX()
        break
      }

      case 'transport:play':
        if (pressed) togglePlay()
        break

      case 'transport:stop':
        if (pressed) {
          player.stop()
          if (appMode.internalPlaying.value) appMode.stopInternalPlayback()
        }
        break

      case 'transport:tap':
        if (pressed) appMode.tapTempo()
        break

      case 'transport:beat-sync':
        if (pressed) appMode.resyncBeat()
        break

      case 'set:next':
        if (pressed) nextSet()
        break

      case 'set:prev':
        if (pressed) prevSet()
        break

      case 'set:section-next':
        if (pressed) perform.cycleSection(1)
        break

      case 'set:section-prev':
        if (pressed) perform.cycleSection(-1)
        break

      case 'set:direct':
        if (pressed && action.setId) {
          store.selectSet(action.setId)
          player.setActiveSet(action.setId)
        }
        break

      case 'set:index':
        if (pressed && typeof action.setIndex === 'number') {
          const s = store.sets.value[action.setIndex]
          if (s) {
            store.selectSet(s.id)
            player.setActiveSet(s.id)
          }
        }
        break

      case 'set:activate':
        if (pressed) {
          const setId = action.setId || store.selectedSet.value?.id
          if (setId) player.setActiveSet(setId)
        }
        break

      case 'set:trigger':
        if (pressed) {
          const setId = action.setId || store.selectedSet.value?.id
          if (setId) {
            player.setActiveSet(setId)
            player.play()
            if (appMode.isTestingMode.value && !appMode.internalPlaying.value) appMode.toggleInternalPlayback()
          }
        }
        break

      case 'pad:fx': {
        if (!action.setId) break
        if (pressed) {
          fxPads.press({
            setId: action.setId,
            quantize: action.quantize ?? 1,
            releaseQuantize: action.releaseQuantize ?? 0.5,
            minHoldBeats: action.minHold ?? 1,
          })
        } else {
          // Clock not running -> immediate drop, so a frozen metronome can
          // never strand an overlay waiting for a release step that won't come.
          fxPads.release(
            action.setId,
            action.releaseQuantize ?? 0.5,
            action.minHold ?? 1,
            !player.isPlaying.value,
          )
        }
        player.updateDMX() // reflect press/release now (like blinder/strobe)
        break
      }

      case 'playback:reverse-hold':
        // Momentary: press = restart from the END and run backward (anchored),
        // release = back to the forward synced position. Works even paused.
        player.setReversePlay(pressed)
        break

      case 'input:mode-toggle':
        if (pressed) appMode.toggleMode()
        break
    }
  }

  return { dispatchAction, nextSet, prevSet, togglePlay }
}
