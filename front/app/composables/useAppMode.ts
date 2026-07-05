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
// Continuous fractional beat position (e.g. 2.5 = halfway through beat 3). Drives
// sub-beat playback in testing mode. internalBeat stays the integer floor of this,
// so every existing integer-beat consumer is unchanged.
const internalBeatFloat = ref(0)

// The internal clock ticks at MAX_SUB steps per beat so sub-beat clips (down to
// 1/4 notes) fire in testing mode. Matches the fixed playback resolution.
const MAX_SUB = 4
let internalSubCounter = 0
let internalInterval: ReturnType<typeof setInterval> | null = null
// Wall-clock anchor for a SMOOTH intra-beat phase (the stepped subCounter only
// has MAX_SUB values/beat, too coarse for the 3D pulse). Beat stepping still uses
// the interval; this is read-only for visuals.
let internalClockStartMs = 0

function internalTick() {
  internalSubCounter++
  internalBeatFloat.value = internalSubCounter / MAX_SUB
  internalBeat.value = Math.floor(internalBeatFloat.value)
}
function startTicker() {
  internalClockStartMs = typeof performance !== 'undefined' ? performance.now() : 0
  const msPerStep = 60000 / (internalTempo.value * MAX_SUB)
  internalInterval = setInterval(internalTick, msPerStep)
}
function resetInternalClock() {
  internalSubCounter = 0
  internalBeatFloat.value = 0
  internalBeat.value = 0
}

// Smooth 0..1 intra-beat phase from wall-clock (for the 3D beat-pulse ring).
// Returns 0 when not running.
function getInternalPhase(): number {
  if (!internalPlaying.value || typeof performance === 'undefined') return 0
  const msPerBeat = 60000 / internalTempo.value
  return ((((performance.now() - internalClockStartMs) / msPerBeat) % 1) + 1) % 1
}

// Tap tempo state
const tapTimes: number[] = []
const TAP_TIMEOUT = 2000 // Reset if no tap for 2 seconds
const TAP_MIN_COUNT = 2  // Need at least 2 taps to calculate

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
    resetInternalClock()
    startTicker()
  }

  function stopInternalPlayback() {
    internalPlaying.value = false
    resetInternalClock()
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

    // Restart ticker at the new rate (preserves current position so changing
    // tempo mid-play does not jump the beat).
    if (internalPlaying.value && internalInterval) {
      clearInterval(internalInterval)
      startTicker()
    }
  }

  // Step to next beat (manual mode)
  function stepBeat() {
    internalSubCounter += MAX_SUB
    internalBeatFloat.value = internalSubCounter / MAX_SUB
    internalBeat.value = Math.floor(internalBeatFloat.value)
  }

  // Beat sync / re-downbeat: snap the beat counter back to 1 and re-phase the
  // tick so "1" lands on the moment you press it (tap this on the music's
  // downbeat to line the lights up). In Link/performance mode the beat follows
  // Link, so this only re-aligns the internal-tempo clock.
  function resyncBeat() {
    resetInternalClock()
    if (internalPlaying.value && internalInterval) {
      clearInterval(internalInterval)
      startTicker()
    }
  }

  // Tap tempo - calculate BPM from tap intervals
  function tapTempo() {
    const now = Date.now()

    // Reset if too much time has passed since last tap
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT) {
      tapTimes.length = 0
    }

    tapTimes.push(now)

    // Keep only last 4 taps for averaging
    if (tapTimes.length > 4) {
      tapTimes.shift()
    }

    // Calculate BPM if we have enough taps
    if (tapTimes.length >= TAP_MIN_COUNT) {
      const intervals: number[] = []
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = Math.round(60000 / avgInterval)
      setInternalTempo(bpm)
    }
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
    internalBeatFloat: readonly(internalBeatFloat),
    getInternalPhase,
    startInternalPlayback,
    stopInternalPlayback,
    toggleInternalPlayback,
    setInternalTempo,
    stepBeat,
    tapTempo,
    resyncBeat,
  }
}
