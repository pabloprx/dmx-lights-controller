import { watch, computed } from 'vue'

export function useBankPlayer() {
  const { state: linkState } = useAbletonLink()
  const { isConnected: serialConnected, sendDMX } = useUnifiedSerial()
  const { activeBank, getSceneAtBeat, getSceneDMX } = useDMXStore()

  let lastSentBeat = -1
  let lastSentSceneId: string | null = null

  // Current cell index in the active bank
  const currentCellIndex = computed(() => {
    if (!activeBank.value || !linkState.value.isPlaying) return -1

    const beat = linkState.value.beat
    const bank = activeBank.value
    const beatInLoop = beat % bank.length
    return Math.floor(beatInLoop / bank.unitDuration)
  })

  // Current beat position within the bank loop (for UI indicator)
  const currentBeatInBank = computed(() => {
    if (!activeBank.value || !linkState.value.isPlaying) return -1
    return linkState.value.beat % activeBank.value.length
  })

  // Watch beat changes and send DMX
  watch(
    () => linkState.value.beat,
    (beat) => {
      if (!linkState.value.isPlaying || !serialConnected.value || !activeBank.value) return

      const beatInt = Math.floor(beat)
      if (beatInt === lastSentBeat) return
      lastSentBeat = beatInt

      // Get current scene
      const scene = getSceneAtBeat(beat)

      // Only send if scene changed
      if (scene?.id !== lastSentSceneId) {
        lastSentSceneId = scene?.id || null

        if (scene) {
          const dmxValues = getSceneDMX(scene.id)
          // Send first 16 channels
          sendDMX(dmxValues.slice(0, 16))
        } else {
          // No scene - send blackout
          sendDMX(new Array(16).fill(0))
        }
      }
    }
  )

  // Force send current scene (useful for preview)
  function sendCurrentScene() {
    if (!serialConnected.value) return

    const beat = linkState.value.beat
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

    const dmxValues = getSceneDMX(sceneId)
    sendDMX(dmxValues.slice(0, 16))
  }

  // Send blackout
  function blackout() {
    if (!serialConnected.value) return
    sendDMX(new Array(16).fill(0))
  }

  return {
    currentCellIndex,
    currentBeatInBank,
    sendCurrentScene,
    previewScene,
    blackout,
  }
}
