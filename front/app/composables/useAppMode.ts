// App Mode: Testing vs Performance
// Testing: Live preview, no beat-sync, serial optional
// Performance: Beat-synced to Link, serial required

export type AppMode = 'testing' | 'performance'

const mode = ref<AppMode>('testing')
const blackout = ref(false)

// Internal tempo for testing mode (BPM)
const internalTempo = ref(120)
const internalPlaying = ref(false)
const internalBeat = ref(0)

let internalInterval: ReturnType<typeof setInterval> | null = null

export function useAppMode() {
  const { isConnected: serialConnected, sendDMX } = useUnifiedSerial()

  const canSwitchToPerformance = computed(() => serialConnected.value)
  const isTestingMode = computed(() => mode.value === 'testing')
  const isPerformanceMode = computed(() => mode.value === 'performance')

  function setMode(newMode: AppMode): boolean {
    if (newMode === 'performance' && !serialConnected.value) {
      console.warn('[AppMode] Cannot switch to performance: serial not connected')
      return false
    }

    // Stop internal playback when switching modes
    if (newMode === 'performance') {
      stopInternalPlayback()
    }

    mode.value = newMode
    return true
  }

  function toggleMode() {
    if (mode.value === 'testing') {
      return setMode('performance')
    } else {
      return setMode('testing')
    }
  }

  // Blackout - kills all DMX output
  function triggerBlackout() {
    blackout.value = true
    if (serialConnected.value) {
      sendDMX(new Array(100).fill(0))
    }
  }

  function releaseBlackout() {
    blackout.value = false
  }

  function toggleBlackout() {
    if (blackout.value) {
      releaseBlackout()
    } else {
      triggerBlackout()
    }
  }

  // Internal tempo playback for testing mode
  function startInternalPlayback() {
    if (internalPlaying.value) return

    internalPlaying.value = true
    internalBeat.value = 0

    const msPerBeat = 60000 / internalTempo.value
    internalInterval = setInterval(() => {
      internalBeat.value++
    }, msPerBeat)
  }

  function stopInternalPlayback() {
    internalPlaying.value = false
    internalBeat.value = 0
    if (internalInterval) {
      clearInterval(internalInterval)
      internalInterval = null
    }
  }

  function toggleInternalPlayback() {
    if (internalPlaying.value) {
      stopInternalPlayback()
    } else {
      startInternalPlayback()
    }
  }

  function setInternalTempo(bpm: number) {
    internalTempo.value = Math.max(20, Math.min(300, bpm))

    // Restart interval if playing
    if (internalPlaying.value) {
      stopInternalPlayback()
      startInternalPlayback()
    }
  }

  // Step to next beat (manual mode)
  function stepBeat() {
    internalBeat.value++
  }

  return {
    // Mode
    mode: readonly(mode),
    isTestingMode,
    isPerformanceMode,
    canSwitchToPerformance,
    setMode,
    toggleMode,

    // Blackout
    blackout: readonly(blackout),
    triggerBlackout,
    releaseBlackout,
    toggleBlackout,

    // Internal tempo (testing mode)
    internalTempo,
    internalPlaying: readonly(internalPlaying),
    internalBeat: readonly(internalBeat),
    startInternalPlayback,
    stopInternalPlayback,
    toggleInternalPlayback,
    setInternalTempo,
    stepBeat,
  }
}
