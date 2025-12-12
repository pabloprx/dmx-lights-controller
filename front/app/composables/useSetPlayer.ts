// Set Player - plays Sets in sync with Ableton Link (performance) or internal tempo (testing)

import { useAbletonLink } from './useAbletonLink'
import { useUnifiedSerial } from './useUnifiedSerial'
import { useDMXStore } from './useDMXStore'
import { useAppMode } from './useAppMode'
import { useAudioReactive } from './useAudioReactive'
import { valuesToDMX } from '~/types/dmx'

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

  // Get the current beat based on Link connection (sync with Link when connected)
  const currentBeat = computed(() => {
    if (link.connected.value) {
      return Math.floor(link.state.value.beat) + 1
    } else {
      return appMode.internalBeat.value + 1
    }
  })

  // Current beat within the set (1-indexed, wraps based on set length)
  // Uses bar-aware logic when Link is connected for proper multi-bar sync
  const beatInSet = computed(() => {
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

  // Phase within current beat (0-1 for animations)
  const beatPhase = computed(() => {
    if (appMode.isPerformanceMode.value) {
      return link.state.value.phase
    }
    return 0 // No phase info for internal tempo
  })

  // Watch beat changes and update DMX
  // We watch beatInSet (not currentBeat) because that's what determines which preset plays
  // This ensures we stay synced with Link's bar-aware beat position
  watch(
    [beatInSet, () => store.activeSetId.value],
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

      const hasPresetAudio = store.getActiveAudioReactiveSettings(set, beatInSet.value).length > 0
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

    const beat = beatInSet.value

    // Start with last sent values (avoid full recalc)
    let channels = lastDMXSent.length > 0 ? [...lastDMXSent] : store.getSetDMX(set, beat).slice(0, 100)

    // Apply preset audio modulation
    channels = audioReactive.applyPresetAudioModulation(channels, set, beat)

    // Apply global audio modulation if enabled
    if (audioReactive.enabled.value) {
      channels = audioReactive.applyAudioModulation(channels)
    }

    // Apply master dimmer
    if (masterDimmer.value < 100) {
      channels = applyMasterDimmer(channels, masterDimmer.value)
    }

    // Skip if unchanged
    if (arraysEqual(channels, lastDMXSent)) return

    lastDMXSent = [...channels]
    serial.sendDMX(channels)
  }

  function updateDMX() {
    const set = store.activeSet.value
    if (!set) {
      sendBlackout()
      return
    }

    // Get DMX values for current beat
    const beat = beatInSet.value
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

    // Apply master dimmer to all devices
    if (masterDimmer.value < 100) {
      channels = applyMasterDimmer(channels, masterDimmer.value)
    }

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
    updateDMX()
  }

  function stop() {
    isPlaying.value = false
    sendBlackout()
  }

  function setActiveSet(setId: string | null) {
    const previousId = store.activeSetId.value
    store.setActiveSet(setId)

    // Force update if set changed (even if not playing yet - play() will be called next)
    if (setId && setId !== previousId) {
      // Reset lastDMXSent to force a fresh send
      lastDMXSent = []
      if (isPlaying.value) {
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

    // Temporarily set as preview (don't update lastDMXSent)
    serial.sendDMX(dmx.slice(0, 16))
  }

  // Preview current beat's state on all devices (for compose mode live feedback)
  function previewCurrentBeat() {
    if (appMode.blackout.value) {
      sendBlackout()
      return
    }

    const set = store.activeSet.value
    if (!set) return

    const beat = beatInSet.value
    const dmxValues = store.getSetDMX(set, beat)
    serial.sendDMX(dmxValues.slice(0, 16))
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
    beatPhase,
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
