import { watch, computed } from 'vue'

export function useBankPlayer() {
  const { state: linkState } = useAbletonLink()
  const { isConnected: serialConnected, sendDMX } = useUnifiedSerial()
  const { activeBank, getSceneAtBeat, getSceneDMX, setActiveBank } = useDMXStore()
  const { isPerformanceMode, isTestingMode, internalBeat, blackout } = useAppMode()
  const {
    pendingBankId,
    loopCurrent,
    executePendingSwitch,
    popNextFromQueue,
  } = useBankQueue()

  let lastSentBeat = -1
  let lastSentSceneId: string | null = null
  let lastBankBeat = -1 // Track beat within bank for loop detection

  // Get current beat based on mode
  const currentBeat = computed(() => {
    if (isPerformanceMode.value) {
      return linkState.value.beat
    }
    return internalBeat.value
  })

  // Is playback active based on mode
  const isPlaying = computed(() => {
    if (isPerformanceMode.value) {
      return linkState.value.isPlaying
    }
    // In testing mode, we always consider it "playing" for manual/auto stepping
    return true
  })

  // Current cell index in the active bank
  const currentCellIndex = computed(() => {
    if (!activeBank.value) return -1

    const beat = currentBeat.value
    const bank = activeBank.value
    const beatInLoop = beat % bank.length
    return Math.floor(beatInLoop / bank.unitDuration)
  })

  // Current beat position within the bank loop (for UI indicator)
  const currentBeatInBank = computed(() => {
    if (!activeBank.value) return -1
    return currentBeat.value % activeBank.value.length
  })

  // Handle scene changes - send DMX when scene changes
  function sendSceneIfChanged(beat: number) {
    if (!activeBank.value) return
    if (blackout.value) return // Don't send if blackout active

    const beatInt = Math.floor(beat)
    if (beatInt === lastSentBeat) return
    lastSentBeat = beatInt

    // Get current scene
    const scene = getSceneAtBeat(beat)

    // Only send if scene changed
    if (scene?.id !== lastSentSceneId) {
      lastSentSceneId = scene?.id || null

      if (scene && serialConnected.value) {
        const dmxValues = getSceneDMX(scene.id)
        // Send first 16 channels
        sendDMX(dmxValues.slice(0, 16))
      } else if (serialConnected.value) {
        // No scene - send blackout
        sendDMX(new Array(16).fill(0))
      }
    }
  }

  // Watch Link beat changes (performance mode)
  watch(
    () => linkState.value.beat,
    (beat) => {
      if (!isPerformanceMode.value) return
      if (!linkState.value.isPlaying) return

      const beatInt = Math.floor(beat)

      // Check for pending bank switch on beat boundary
      if (pendingBankId.value) {
        executePendingSwitch()
        lastSentSceneId = null // Force scene re-send after switch
        lastBankBeat = -1
      }

      // Check for bank end (loop or queue transition)
      if (activeBank.value) {
        const bankBeat = beatInt % activeBank.value.length

        // Detect when bank loops (beat goes from high to low)
        if (lastBankBeat >= 0 && bankBeat < lastBankBeat) {
          // Bank just looped
          if (!loopCurrent.value) {
            // Not looping - try to get next from queue
            const nextBankId = popNextFromQueue()
            if (nextBankId) {
              setActiveBank(nextBankId)
              lastSentSceneId = null
            }
          }
        }
        lastBankBeat = bankBeat
      }

      sendSceneIfChanged(beat)
    }
  )

  // Watch internal beat changes (testing mode)
  watch(
    () => internalBeat.value,
    (beat) => {
      if (!isTestingMode.value) return
      sendSceneIfChanged(beat)
    }
  )

  // Force send current scene (useful for preview)
  function sendCurrentScene() {
    if (!serialConnected.value) return
    if (blackout.value) return

    const beat = currentBeat.value
    const scene = getSceneAtBeat(beat)

    if (scene) {
      const dmxValues = getSceneDMX(scene.id)
      sendDMX(dmxValues.slice(0, 16))
    } else {
      sendDMX(new Array(16).fill(0))
    }
  }

  // Send a specific scene (for preview in editor)
  function previewScene(sceneId: string) {
    if (!serialConnected.value) return
    if (blackout.value) return

    const dmxValues = getSceneDMX(sceneId)
    sendDMX(dmxValues.slice(0, 16))
  }

  return {
    currentBeat,
    currentCellIndex,
    currentBeatInBank,
    isPlaying,
    sendCurrentScene,
    previewScene,
  }
}
