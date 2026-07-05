// Set Player - plays Sets in sync with Ableton Link (performance) or internal tempo (testing)

import { useAbletonLink } from './useAbletonLink'
import { useUnifiedSerial } from './useUnifiedSerial'
import { useDMXStore } from './useDMXStore'
import { useAppMode } from './useAppMode'
import { useAudioReactive } from './useAudioReactive'
import { useFxPads } from './useFxPads'
import { valuesToDMX, STROBE_MIN, STROBE_MAX } from '~/types/dmx'
import { computeStepInSet, PLAYBACK_STEPS, armReverseHere, releaseReverseHere, sampleReverseHere } from '~/lib/beatMath'
import type { ReverseHereState } from '~/lib/beatMath'
import {
  buildSlots, lrBalanceGains,
  applyBalanceToFrame, applyTintToFrame, applyBlinderToFrame, applyBlackoutToFrame,
} from '~/lib/overrideMath'

// Dimmer channel configuration
export interface DimmerChannelConfig {
  channel: number    // DMX channel (1-indexed)
  min: number        // Min value (e.g., 0)
  max: number        // Max value (e.g., 134 for pinspot dimmer range)
}

// Shared state (singleton)
const isPlaying = ref(false)
const loopEnabled = ref(true)
const masterDimmer = ref(100) // 0-100%
const dimmerChannels = ref<DimmerChannelConfig[]>([])

// Export master dimmer for use by other composables (e.g., useDMXStore for preview)
export { masterDimmer }

// Momentary strobe override (driven by input actions, e.g. gamepad LT held).
// When active, every RGBW fixture's ch0 is forced into the strobe band each frame.
export const manualStrobe = ref<{ active: boolean; speed01: number }>({ active: false, speed01: 0.6 })

// ── Live performance override layer (gamepad RB/LB + sticks) ───────────────
// Applied as a post-process on the final frame. See updateDMX for compositing
// order. All neutral by default so a resting controller has zero effect.
export const manualBlinder = ref<{ active: boolean; level01: number }>({ active: false, level01: 1 }) // RB held
export const manualHold = ref<{ blackout: boolean }>({ blackout: false })                              // LB held
export const lrBalance = ref(0.5)                                                                       // 0 left .. 0.5 even .. 1 right (L-stick X)
export const colorTint = ref<{ hue01: number; amount01: number }>({ hue01: 0, amount01: 0 })            // R-stick wash
// Momentary reverse playback (L3 held), VARIANT C: reverse FROM THE CURRENT
// position (3 -> 2 -> 1 -> 8 -> 7...), with BOTH edges quantized to the whole
// beat - engage and release land on time, never mid-click. The clock keeps
// running forward underneath; only the sampled position walks backward.
// (Rollback variants kept in beatMath: A = phase-locked mirror (mirrorStep),
// B = restart from the end (reverseFromEnd).)
export const reversePlay = ref(false) // raw button-held state
const reverseState = ref<ReverseHereState | null>(null)

// Load dimmer config from localStorage
const DIMMER_CONFIG_KEY = 'dmx-dimmer-config'
function loadDimmerConfig() {
  if (typeof window === 'undefined') return
  try {
    const saved = localStorage.getItem(DIMMER_CONFIG_KEY)
    if (saved) {
      dimmerChannels.value = JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to load dimmer config:', e)
  }
}
function saveDimmerConfig() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DIMMER_CONFIG_KEY, JSON.stringify(dimmerChannels.value))
  } catch (e) {
    console.warn('Failed to save dimmer config:', e)
  }
}
loadDimmerConfig()

// Last sent DMX values for comparison (avoid redundant sends)
let lastDMXSent: number[] = []

export function useSetPlayer() {
  const link = useAbletonLink()
  const serial = useUnifiedSerial()
  const store = useDMXStore()
  const appMode = useAppMode()
  const audioReactive = useAudioReactive()
  const fxPads = useFxPads()

  // Get the current beat based on Link connection (sync with Link when connected)
  const currentBeat = computed(() => {
    if (link.connected.value) {
      return Math.floor(link.state.value.beat) + 1
    } else {
      return appMode.internalBeat.value + 1
    }
  })

  // Current beat within the set (1-indexed, wraps based on set length)
  // Uses bar-aware logic when Link is connected for proper multi-bar sync.
  // RAW = the forward clock position; the reverse mirror is applied only in
  // the public beatInSet/stepInSet views (never here, so it can't double-apply).
  const rawBeatInSet = computed(() => {
    const set = store.activeSet.value
    if (!set) return 1

    // When Link is connected, use bar-aware calculation
    if (link.connected.value) {
      const { barNumber, beatInBar, quantum } = link.state.value
      // Calculate how many bars fit in this set
      const barsInSet = Math.ceil(set.length / quantum)
      // Which bar within the set are we in? (0-indexed)
      const barInSet = barNumber % barsInSet
      // Calculate absolute beat position: (bar * quantum) + beatInBar
      const absoluteBeat = barInSet * quantum + beatInBar
      // Clamp to set length (in case set isn't exactly divisible by quantum)
      return Math.min(absoluteBeat, set.length)
    }

    // Internal tempo mode: simple modulo
    if (loopEnabled.value) {
      return ((currentBeat.value - 1) % set.length) + 1
    }
    return Math.min(currentBeat.value, set.length)
  })

  // Public view: while reverse is ACTIVE (engaged on-beat, not merely held),
  // derive the displayed beat from the reversed step so the counter counts
  // down in lockstep with what is actually sampled. (stepInSet is declared
  // below; computed getters run lazily post-setup, so the reference is safe.)
  const beatInSet = computed(() => {
    const set = store.activeSet.value
    if (!set || !reverseActive.value) return rawBeatInSet.value
    return Math.floor(stepInSet.value)
  })

  // Phase within current beat (0-1 for animations)
  const beatPhase = computed(() => {
    if (appMode.isPerformanceMode.value) {
      return link.state.value.phase
    }
    return 0 // No phase info for internal tempo
  })

  // Intra-beat phase 0..1 that works in BOTH modes (Link or internal tempo).
  // Used by the 3D visualizer for a beat-synced pulse during practice too.
  const phase01 = computed(() => {
    if (link.connected.value) return link.state.value.phase % 1
    return appMode.internalBeatFloat.value % 1
  })

  // Sub-beat position: the 1-indexed FRACTIONAL beat fed to clip lookup. With
  // subdivision 1 this equals beatInSet (identical to before). With subdivision 2
  // it lands on half-beats (1, 1.5, 2, ...) so rapid changes fire mid-beat,
  // without touching BPM/sync (it is derived from the SAME beat clock).
  const forwardStepInSet = computed(() => {
    const set = store.activeSet.value
    if (!set) return rawBeatInSet.value
    // Sample at the FIXED playback resolution (1/4), independent of the per-set
    // pencil, so every clip (1, 1/2, 1/4) triggers regardless of the grid view.
    return computeStepInSet({
      linkConnected: link.connected.value,
      linkPhase: link.state.value.phase,
      internalBeatFloat: appMode.internalBeatFloat.value,
      beatInSet: rawBeatInSet.value,
      subdivision: PLAYBACK_STEPS,
    })
  })

  const stepInSet = computed(() => {
    const set = store.activeSet.value
    if (!set) return rawBeatInSet.value
    const fwd = forwardStepInSet.value
    const st = reverseState.value
    if (!st) return fwd
    // Reverse: forward until the engage boundary, then walk backward from the
    // position AT that boundary (seamless - both agree there), forward again
    // after the release boundary. All transitions land ON the beat.
    return sampleReverseHere(st, fxPads.globalStepFloat.value, fwd, set.length).pos
  })

  // True while the OUTPUT is actually reversed (from the engage beat until the
  // release beat) - drives the badge + countdown so UI reflects the light, not
  // the button.
  const reverseActive = computed(() => {
    const set = store.activeSet.value
    const st = reverseState.value
    if (!set || !st) return false
    return sampleReverseHere(st, fxPads.globalStepFloat.value, forwardStepInSet.value, set.length).reversed
  })

  // Engage/release momentary reverse, both edges quantized to the next whole
  // beat (pressing exactly on a beat engages on that beat). No forced frame:
  // engage is seamless by construction and disengage flips stepInSet, which
  // the step watcher turns into a frame.
  function setReversePlay(active: boolean) {
    reversePlay.value = active
    const set = store.activeSet.value
    if (!set) {
      reverseState.value = null
      return
    }
    const abs = fxPads.globalStepFloat.value
    if (active) {
      reverseState.value = armReverseHere(abs, forwardStepInSet.value, set.length)
    } else if (reverseState.value) {
      reverseState.value = releaseReverseHere(reverseState.value, abs)
    }
  }

  // Watch beat changes and update DMX
  // We watch beatInSet (not currentBeat) because that's what determines which preset plays
  // This ensures we stay synced with Link's bar-aware beat position.
  // fxPads.globalStepFloat also advances every playback step, so scheduled pad
  // launches/releases fire even when there is no active set (stepInSet frozen).
  watch(
    [stepInSet, () => store.activeSetId.value, fxPads.globalStepFloat],
    () => {
      if (!isPlaying.value) return
      if (appMode.blackout.value) {
        sendBlackout()
        return
      }
      updateDMX()
    }
  )

  // Watch blackout changes
  watch(() => appMode.blackout.value, (isBlackout) => {
    if (isBlackout) {
      sendBlackout()
    } else if (isPlaying.value) {
      updateDMX()
    }
  })

  // Watch mode changes - auto-play when entering performance mode
  watch(appMode.isPerformanceMode, (isPerf) => {
    if (isPerf && store.activeSet.value) {
      play()
    }
  })

  // Watch audio levels for audio-reactive mode (continuous updates)
  // Use a dedicated fast path that only updates audio-reactive channels
  watch(
    () => serial.audioLevels.value,
    () => {
      if (!isPlaying.value) return
      if (appMode.blackout.value) return

      // Fast path: only update if we have audio-reactive presets or global mode
      const set = store.activeSet.value
      if (!set) return

      const hasPresetAudio = store.getActiveAudioReactiveSettings(set, stepInSet.value).length > 0
      if (!hasPresetAudio && !audioReactive.enabled.value) return

      // Use fast audio update (skip full DMX recalc)
      updateAudioReactiveOnly()
    },
    { deep: true }
  )

  // Fast path: only update audio-reactive channels without full recalc
  function updateAudioReactiveOnly() {
    const set = store.activeSet.value
    if (!set) return

    const beat = stepInSet.value

    // Seed from the CLEAN base each frame (not lastDMXSent, which already has the
    // override layer applied). Re-applying tint/balance/dimmer on their own prior
    // output compounds non-idempotently and saturates. arraysEqual still dedups sends.
    let channels = store.getSetDMX(set, beat).slice(0, 100)

    // Apply preset audio modulation
    channels = audioReactive.applyPresetAudioModulation(channels, set, beat)

    // Apply global audio modulation if enabled
    if (audioReactive.enabled.value) {
      channels = audioReactive.applyAudioModulation(channels)
    }

    // FX pads overlay the (modulated) base, then the manual layer goes on top
    channels = fxPads.applyToFrame(channels)

    // Live performance layer (same fixed order as updateDMX)
    channels = applyColorTint(channels)
    channels = applyLrBalance(channels)
    channels = applyManualStrobe(channels)
    if (masterDimmer.value < 100) {
      channels = applyMasterDimmer(channels, masterDimmer.value)
    }
    channels = applyBlinder(channels)
    channels = applyHold(channels)

    // Skip if unchanged
    if (arraysEqual(channels, lastDMXSent)) return

    lastDMXSent = [...channels]
    serial.sendDMX(channels)
  }

  // Force every RGBW fixture into the strobe band (momentary strobe override).
  function applyManualStrobe(channels: number[]): number[] {
    if (!manualStrobe.value.active) return channels
    const result = [...channels]
    const ch0 = Math.round(STROBE_MIN + manualStrobe.value.speed01 * (STROBE_MAX - STROBE_MIN))
    for (const device of store.devices.value) {
      const profile = store.getProfile(device.profileId)
      if (!profile || profile.controlType !== 'rgbw') continue
      const idx = device.startChannel - 1
      if (idx < 0 || idx >= result.length) continue
      result[idx] = ch0
      // If the fixture is otherwise dark, flash white so the strobe is visible
      const sum = (result[idx + 1] || 0) + (result[idx + 2] || 0) + (result[idx + 3] || 0) + (result[idx + 4] || 0)
      if (sum === 0 && idx + 4 < result.length) result[idx + 4] = 255
    }
    return result
  }

  // ── Override-layer wrappers (thin; pure math lives in overrideMath.ts) ──────
  function slots() {
    return buildSlots(store.devices.value, id => store.getProfile(id))
  }
  function applyColorTint(channels: number[]): number[] {
    if (colorTint.value.amount01 <= 0) return channels
    return applyTintToFrame(channels, slots(), colorTint.value.hue01, colorTint.value.amount01)
  }
  function applyLrBalance(channels: number[]): number[] {
    if (Math.abs(lrBalance.value - 0.5) < 0.001) return channels
    return applyBalanceToFrame(channels, slots(), lrBalanceGains(lrBalance.value))
  }
  function applyBlinder(channels: number[]): number[] {
    if (!manualBlinder.value.active) return channels
    return applyBlinderToFrame(channels, slots(), manualBlinder.value.level01)
  }
  function applyHold(channels: number[]): number[] {
    if (!manualHold.value.blackout) return channels
    return applyBlackoutToFrame(channels)
  }
  // Any live-layer override engaged? (used by the no-set path)
  function overrideEngaged(): boolean {
    return manualStrobe.value.active || manualBlinder.value.active || manualHold.value.blackout
      || colorTint.value.amount01 > 0 || Math.abs(lrBalance.value - 0.5) >= 0.001
      || fxPads.activeCount.value > 0
  }

  function updateDMX() {
    const set = store.activeSet.value
    if (!set) {
      // No active set: still honour the live override layer (blinder/strobe/hold)
      // so RB/LB work even with nothing loaded.
      if (overrideEngaged()) {
        let ch = new Array(100).fill(0)
        ch = fxPads.applyToFrame(ch) // pads play over black when nothing is loaded
        ch = applyColorTint(ch)   // wash works even with no set loaded
        ch = applyLrBalance(ch)
        ch = applyManualStrobe(ch)
        ch = applyBlinder(ch)
        ch = applyHold(ch)
        // Record lastDMXSent so a later release isn't falsely deduped against a
        // stale frame (which would leave the rig stuck blinded/strobing).
        if (!arraysEqual(ch, lastDMXSent)) {
          lastDMXSent = [...ch]
          serial.sendDMX(ch)
        }
      } else {
        sendBlackout()
      }
      return
    }

    // Get DMX values for current sub-beat step
    const beat = stepInSet.value
    const dmxValues = store.getSetDMX(set, beat)

    // Use all 100 channels
    let channels = dmxValues.slice(0, 100)

    // Apply audio modulation
    // 1. Preset-based audio reactive (per-preset settings)
    channels = audioReactive.applyPresetAudioModulation(channels, set, beat)

    // 2. Legacy global audio modulation (if enabled)
    if (audioReactive.enabled.value) {
      channels = audioReactive.applyAudioModulation(channels)
    }

    // ── FX pads: held-button set overlays, per-fixture opaque where the pad's
    // set has an active clip. On top of the (audio-modulated) base, UNDER the
    // manual layer so tint/dimmer/blinder/blackout still govern everything. ──
    channels = fxPads.applyToFrame(channels)

    // ── Live performance layer (fixed compositing order) ──
    channels = applyColorTint(channels)    // right stick: recolor the look (before strobe owns ch0)
    channels = applyLrBalance(channels)    // left stick: L/R intensity pan (before dimmer scales it)
    channels = applyManualStrobe(channels) // LT held: strobe band on ch0
    if (masterDimmer.value < 100) {        // master fader
      channels = applyMasterDimmer(channels, masterDimmer.value)
    }
    channels = applyBlinder(channels)      // RB held: full white, AFTER dimmer (a blinder must read full)
    channels = applyHold(channels)         // LB held: blackout, ABSOLUTELY LAST (wins over everything)

    // Skip if values haven't changed
    if (arraysEqual(channels, lastDMXSent)) {
      return
    }

    lastDMXSent = [...channels]
    serial.sendDMX(channels)
  }

  function sendBlackout() {
    const blackoutValues = new Array(100).fill(0)
    if (!arraysEqual(blackoutValues, lastDMXSent)) {
      lastDMXSent = blackoutValues
      serial.sendDMX(blackoutValues)
    }
  }

  function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // Apply master dimmer to ALL devices
  // For normal mode: scale channel 0 (dimmer)
  // For strobe mode: scale RGB channels (1-3) since they control intensity
  function applyMasterDimmer(channels: number[], dimmerPercent: number): number[] {
    const result = [...channels]
    const scale = dimmerPercent / 100

    // Auto-apply to all devices
    const devices = store.devices.value
    for (const device of devices) {
      const idx = device.startChannel - 1 // Convert to 0-indexed
      if (idx >= 0 && idx < result.length) {
        const baseDimmer = result[idx]

        // Check if device is in strobe mode (135-239 on channel 0)
        const isStrobeMode = baseDimmer >= 135 && baseDimmer <= 239

        if (isStrobeMode) {
          // Strobe mode: dim the RGB channels instead (offsets 1-3)
          // In strobe mode, RGB channels control intensity/color
          for (let rgbOffset = 1; rgbOffset <= 3; rgbOffset++) {
            const rgbIdx = idx + rgbOffset
            if (rgbIdx < result.length) {
              result[rgbIdx] = Math.round(result[rgbIdx] * scale)
            }
          }
          // Also scale white channel (offset 4) if present
          const whiteIdx = idx + 4
          if (whiteIdx < result.length) {
            result[whiteIdx] = Math.round(result[whiteIdx] * scale)
          }
        } else if (baseDimmer >= 9 && baseDimmer <= 134) {
          // Normal dimmer mode: scale channel 0
          const intensity = (baseDimmer - 9) / 125 // 0-1
          result[idx] = Math.round(9 + intensity * scale * 125)
        } else if (baseDimmer >= 240) {
          // Full mode: convert to scaled dimmer
          result[idx] = Math.round(9 + scale * 125)
        }
      }
    }

    // Also apply any manually configured channels (for non-device channels)
    for (const config of dimmerChannels.value) {
      const idx = config.channel - 1
      if (idx >= 0 && idx < result.length) {
        const range = config.max - config.min
        const dimmedValue = Math.round(config.min + range * scale)
        result[idx] = Math.min(result[idx], dimmedValue)
      }
    }

    return result
  }

  // Master dimmer control
  function setMasterDimmer(value: number) {
    masterDimmer.value = Math.max(0, Math.min(100, value))
    if (isPlaying.value && !appMode.blackout.value) {
      lastDMXSent = [] // Force update
      updateDMX()
    } else if (!isPlaying.value) {
      // Testing mode: refresh DMX output with new dimmer value
      store.refreshDMXWithDimmer()
    }
  }

  // Dimmer channel config functions
  function addDimmerChannel(config: DimmerChannelConfig) {
    // Remove existing config for same channel
    dimmerChannels.value = dimmerChannels.value.filter(c => c.channel !== config.channel)
    dimmerChannels.value.push(config)
    saveDimmerConfig()
  }

  function removeDimmerChannel(channel: number) {
    dimmerChannels.value = dimmerChannels.value.filter(c => c.channel !== channel)
    saveDimmerConfig()
  }

  function clearDimmerChannels() {
    dimmerChannels.value = []
    saveDimmerConfig()
  }

  // Control functions
  function play() {
    isPlaying.value = true
    lastDMXSent = [] // Reset to force fresh send
    // In testing mode the beat clock is the internal tempo ticker. Start it here
    // so EVERY play entry point (transport, Perform cards, SetEditor, gamepad)
    // actually advances beats + the 3D pulse. startInternalPlayback is guarded
    // against double-start, so this composes with togglePlay's own toggle.
    if (appMode.isTestingMode.value && !appMode.internalPlaying.value) {
      appMode.startInternalPlayback()
    }
    updateDMX()
  }

  function stop() {
    isPlaying.value = false
    if (appMode.internalPlaying.value) appMode.stopInternalPlayback()
    sendBlackout()
  }

  function setActiveSet(setId: string | null) {
    store.setActiveSet(setId)

    // X always means "play this set from its downbeat, NOW" - including
    // re-pressing on the already-active set (a silent no-op there reads as a
    // laggy/unresponsive button live).
    if (setId) {
      // Re-trigger from the opening beat so the scene shows its intended look
      // INSTANTLY - instead of continuing from the current beat and possibly
      // landing in a mid-pattern dark gap (the "scene change takes a while /
      // goes black" feel). Testing mode only; under Link the beat follows Link.
      if (appMode.isTestingMode.value) appMode.resyncBeat()

      // Push the new frame IMMEDIATELY - even when stopped/paused - so activating
      // (gamepad X = "preview this look") shows it at once instead of leaving the
      // rig on the previous frame or a blackout.
      lastDMXSent = [] // force a fresh send past the dedup
      if (appMode.blackout.value) {
        sendBlackout()
      } else {
        updateDMX()
      }
    }
  }

  // Preview a preset on specific devices (for live testing in compose mode)
  function previewPreset(presetId: string, deviceIds: string[]) {
    const preset = store.getPreset(presetId)
    if (!preset) return

    const dmx = new Array(512).fill(0)

    for (const deviceId of deviceIds) {
      const device = store.getDevice(deviceId)
      if (!device) continue

      const channels = valuesToDMX(preset.values)
      const start = device.startChannel - 1

      for (let i = 0; i < channels.length && start + i < 512; i++) {
        dmx[start + i] = channels[i]
      }
    }

    // Full 100-channel frame (16 blacked out every fixture patched above ch16).
    serial.sendDMX(dmx.slice(0, 100))
    // Reset the dedup so the next real updateDMX frame always reaches the wire
    // (otherwise the rig can stay stuck on this preview).
    lastDMXSent = []
  }

  // Preview current beat's state on all devices (for compose mode live feedback)
  function previewCurrentBeat() {
    if (appMode.blackout.value) {
      sendBlackout()
      return
    }

    const set = store.activeSet.value
    if (!set) return

    const beat = stepInSet.value
    const dmxValues = store.getSetDMX(set, beat)
    serial.sendDMX(dmxValues.slice(0, 100))
    lastDMXSent = []
  }

  // Get overlapping devices at current beat (for UI warnings)
  const overlappingDevices = computed(() => {
    const set = store.activeSet.value
    if (!set) return new Map<string, string[]>()
    return store.getOverlappingDevices(set, beatInSet.value)
  })

  return {
    // State
    isPlaying: readonly(isPlaying),
    currentBeat,
    beatInSet,
    stepInSet,
    beatPhase,
    phase01,
    reversePlay: readonly(reversePlay),
    reverseActive,
    setReversePlay,
    loopEnabled,
    masterDimmer: readonly(masterDimmer),
    setMasterDimmer,
    dimmerChannels: readonly(dimmerChannels),
    addDimmerChannel,
    removeDimmerChannel,
    clearDimmerChannels,
    overlappingDevices,

    // Link state passthrough
    linkConnected: link.connected,
    linkState: link.state,
    connectLink: link.connect,
    disconnectLink: link.disconnect,

    // Serial state passthrough
    serialConnected: serial.isConnected,
    connectSerial: serial.connect,
    disconnectSerial: serial.disconnect,

    // Audio reactive
    audioReactive: {
      enabled: audioReactive.enabled,
      band: audioReactive.band,
      sensitivity: audioReactive.sensitivity,
      minLevel: audioReactive.minLevel,
      currentLevel: audioReactive.currentLevel,
      toggle: audioReactive.toggle,
      setBand: audioReactive.setBand,
      setSensitivity: audioReactive.setSensitivity,
      setMinLevel: audioReactive.setMinLevel,
    },

    // Control
    play,
    stop,
    setActiveSet,
    previewPreset,
    previewCurrentBeat,
    updateDMX,
  }
}
