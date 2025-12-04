// Set Player - plays Sets in sync with Ableton Link (performance) or internal tempo (testing)

import { useAbletonLink } from './useAbletonLink'
import { useUnifiedSerial } from './useUnifiedSerial'
import { useDMXStore } from './useDMXStore'
import { useAppMode } from './useAppMode'
import { useAudioReactive } from './useAudioReactive'
import { valuesToDMX } from '~/types/dmx'

// Shared state (singleton)
const isPlaying = ref(false)
const loopEnabled = ref(true)

// Last sent DMX values for comparison (avoid redundant sends)
let lastDMXSent: number[] = []

export function useSetPlayer() {
  const link = useAbletonLink()
  const serial = useUnifiedSerial()
  const store = useDMXStore()
  const appMode = useAppMode()
  const audioReactive = useAudioReactive()

  // Get the current beat based on mode
  const currentBeat = computed(() => {
    if (appMode.isPerformanceMode.value) {
      return Math.floor(link.state.value.beat) + 1
    } else {
      return appMode.internalBeat.value + 1
    }
  })

  // Current beat within the set (1-indexed, wraps based on set length)
  const beatInSet = computed(() => {
    const set = store.activeSet.value
    if (!set) return 1

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
  watch(
    [currentBeat, () => store.activeSetId.value],
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
  watch(
    () => serial.audioLevels.value,
    () => {
      if (!audioReactive.enabled.value) return
      if (!isPlaying.value) return
      if (appMode.blackout.value) return
      updateDMX()
    },
    { deep: true }
  )

  function updateDMX() {
    const set = store.activeSet.value
    if (!set) {
      sendBlackout()
      return
    }

    // Get DMX values for current beat
    const beat = beatInSet.value
    const dmxValues = store.getSetDMX(set, beat)

    // Only send first 16 channels (hardware limit)
    let channels = dmxValues.slice(0, 16)

    // Apply audio modulation if enabled
    if (audioReactive.enabled.value) {
      channels = audioReactive.applyAudioModulation(channels)
    }

    // Skip if values haven't changed
    if (arraysEqual(channels, lastDMXSent)) {
      return
    }

    lastDMXSent = [...channels]
    serial.sendDMX(channels)
  }

  function sendBlackout() {
    const blackoutValues = new Array(16).fill(0)
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
