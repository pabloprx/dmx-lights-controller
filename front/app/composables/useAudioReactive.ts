// Audio Reactive DMX - modulates dimmer based on audio FFT levels
// Maps bass/mid/high to DMX dimmer intensity

export type AudioBand = 'bass' | 'mid' | 'high'

// Shared state (singleton)
const enabled = ref(false)
const band = ref<AudioBand>('bass')
const sensitivity = ref(100) // 0-200%, 100 = 1:1 mapping
const minLevel = ref(0) // Floor level (0-100)

export function useAudioReactive() {
  const { audioLevels } = useUnifiedSerial()
  const store = useDMXStore()

  // Get current audio level for selected band (0-100)
  const currentLevel = computed(() => {
    const level = audioLevels.value[band.value]
    // Apply sensitivity and min level
    const adjusted = minLevel.value + (level * (sensitivity.value / 100))
    return Math.min(100, Math.max(0, adjusted))
  })

  // Apply audio modulation to DMX values
  // Modulates channel 0 (dimmer) for each device in the 16-channel window
  function applyAudioModulation(baseDMX: number[]): number[] {
    if (!enabled.value) return baseDMX

    const modulated = [...baseDMX]
    const level = currentLevel.value / 100 // 0-1

    // Get all devices and their start channels
    const devices = store.devices.value

    for (const device of devices) {
      const start = device.startChannel - 1 // 0-indexed

      // Only modulate if within our 100-channel window
      if (start < 100) {
        // Channel 0 relative to device is the dimmer
        const dimmerChannel = start

        // Get the base dimmer value
        const baseDimmer = modulated[dimmerChannel] || 0

        // For PinSpot: dimmer range is 9-134, strobe is 135-239, full is 240-255
        // Only modulate if it's in dimmer range (9-134) or full range (240-255)
        if (baseDimmer >= 9 && baseDimmer <= 134) {
          // Dimmer mode: scale the dimmer value by audio level
          const intensity = (baseDimmer - 9) / 125 // 0-1
          const modulatedIntensity = intensity * level
          modulated[dimmerChannel] = Math.round(9 + modulatedIntensity * 125)
        } else if (baseDimmer >= 240) {
          // Full mode: modulate as dimmer instead
          const modulatedIntensity = level
          modulated[dimmerChannel] = Math.round(9 + modulatedIntensity * 125)
        }
        // Don't modulate strobe mode (135-239)
      }
    }

    return modulated
  }

  function toggle() {
    enabled.value = !enabled.value
  }

  function setBand(newBand: AudioBand) {
    band.value = newBand
  }

  function setSensitivity(value: number) {
    sensitivity.value = Math.max(0, Math.min(200, value))
  }

  function setMinLevel(value: number) {
    minLevel.value = Math.max(0, Math.min(100, value))
  }

  return {
    // State
    enabled,
    band,
    sensitivity,
    minLevel,
    currentLevel,

    // Controls
    toggle,
    setBand,
    setSensitivity,
    setMinLevel,

    // For external use
    applyAudioModulation,
  }
}
