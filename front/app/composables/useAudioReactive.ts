// Audio Reactive DMX - modulates channels based on audio FFT levels
// Supports per-channel mapping: bass→ch1, mid→ch2, high→ch3, etc.

import type { AudioBand, PresetAudioReactive, AudioCurve } from '~/types/dmx'
export type { AudioBand, AudioCurve }

// Per-channel audio mapping (legacy global mappings)
export interface AudioChannelMapping {
  id: string
  band: AudioBand
  deviceId: string
  channelOffset: number  // 0=dimmer, 1=R, 2=G, 3=B, 4=W
  min: number           // DMX min output
  max: number           // DMX max output
}

// Storage key
const STORAGE_KEY = 'dmx-audio-mappings'

// Shared state (singleton)
const enabled = ref(false)
const band = ref<AudioBand>('bass')  // Legacy: global band selection
const sensitivity = ref(100) // 0-200%, 100 = 1:1 mapping
const minLevel = ref(0) // Floor level (0-100)

// Per-channel mappings
const channelMappings = ref<AudioChannelMapping[]>([])

// Load mappings from storage
function loadMappings() {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      channelMappings.value = JSON.parse(stored)
    }
  } catch (e) {
    console.warn('[AudioReactive] Failed to load mappings:', e)
  }
}

function saveMappings() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channelMappings.value))
  } catch (e) {
    console.warn('[AudioReactive] Failed to save mappings:', e)
  }
}

// Initialize
loadMappings()

export function useAudioReactive() {
  const { audioLevels } = useUnifiedSerial()
  const store = useDMXStore()

  // Get current audio level for selected band (0-100) - legacy global
  const currentLevel = computed(() => {
    const level = audioLevels.value[band.value]
    const adjusted = minLevel.value + (level * (sensitivity.value / 100))
    return Math.min(100, Math.max(0, adjusted))
  })

  // Get level for a specific band
  function getBandLevel(audioBand: AudioBand): number {
    const level = audioLevels.value[audioBand]
    const adjusted = minLevel.value + (level * (sensitivity.value / 100))
    return Math.min(100, Math.max(0, adjusted)) / 100 // 0-1
  }

  // Apply audio modulation to DMX values (legacy global mode)
  function applyAudioModulation(baseDMX: number[]): number[] {
    if (!enabled.value) return baseDMX

    const modulated = [...baseDMX]

    // If we have per-channel mappings, use them
    if (channelMappings.value.length > 0) {
      for (const mapping of channelMappings.value) {
        const device = store.getDevice(mapping.deviceId)
        if (!device) continue

        const channelIdx = device.startChannel - 1 + mapping.channelOffset
        if (channelIdx < 0 || channelIdx >= 100) continue

        const level = getBandLevel(mapping.band)
        const range = mapping.max - mapping.min
        modulated[channelIdx] = Math.round(mapping.min + level * range)
      }
    } else {
      // Legacy: apply global band to all device dimmers
      const level = currentLevel.value / 100
      const devices = store.devices.value

      for (const device of devices) {
        const start = device.startChannel - 1

        if (start < 100) {
          const dimmerChannel = start
          const baseDimmer = modulated[dimmerChannel] || 0

          // PinSpot dimmer range: 9-134
          if (baseDimmer >= 9 && baseDimmer <= 134) {
            const intensity = (baseDimmer - 9) / 125
            const modulatedIntensity = intensity * level
            modulated[dimmerChannel] = Math.round(9 + modulatedIntensity * 125)
          } else if (baseDimmer >= 240) {
            modulated[dimmerChannel] = Math.round(9 + level * 125)
          }
        }
      }
    }

    return modulated
  }

  // Convert percentage (0-100) to DMX value based on channel type
  // For dimmer channel (offset 0): maps to PinSpot 9-134 range
  // For other channels: maps to 0-255
  function percentToDMX(percent: number, channelOffset: number): number {
    if (channelOffset === 0) {
      // Dimmer channel: 9-134 range (PinSpot)
      return Math.round(9 + (percent / 100) * 125)
    }
    // RGB/W channels: 0-255
    return Math.round((percent / 100) * 255)
  }

  // Apply curve to normalized value (0-1 input, 0-1 output)
  function applyCurve(value: number, curve: AudioCurve): number {
    switch (curve) {
      case 'square':
        // Instant on/off - if any signal, full output
        return value > 0 ? 1 : 0
      case 'sine':
        // Smooth ease-in-out (sine curve)
        return (1 - Math.cos(value * Math.PI)) / 2
      case 'linear':
      default:
        return value
    }
  }

  // Apply preset-based audio reactive modulation (new per-preset mode)
  function applyPresetAudioModulation(baseDMX: number[], set: any, beat: number): number[] {
    const activeSettings = store.getActiveAudioReactiveSettings(set, beat)
    if (activeSettings.length === 0) return baseDMX

    const modulated = [...baseDMX]

    for (const { preset, channelIdx } of activeSettings) {
      const ar = preset.audioReactive!
      const rawLevel = audioLevels.value[ar.band]

      // Check threshold (gate) - don't react if below threshold
      if (rawLevel < ar.threshold) {
        // Below threshold: output minimum value
        modulated[channelIdx] = percentToDMX(ar.min, ar.channel)
        continue
      }

      // Scale audio level to output range
      // Map audio (threshold-100) to output (min-max)
      const audioRange = 100 - ar.threshold
      const normalizedLevel = audioRange > 0
        ? (rawLevel - ar.threshold) / audioRange
        : 1

      // Apply curve
      const curvedLevel = applyCurve(normalizedLevel, ar.curve || 'linear')

      // Calculate output percentage
      const outputPercent = ar.min + curvedLevel * (ar.max - ar.min)

      // Convert to DMX
      modulated[channelIdx] = percentToDMX(outputPercent, ar.channel)
    }

    return modulated
  }

  // Mapping CRUD
  function addChannelMapping(mapping: Omit<AudioChannelMapping, 'id'>) {
    const newMapping: AudioChannelMapping = {
      ...mapping,
      id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    channelMappings.value.push(newMapping)
    saveMappings()
    return newMapping
  }

  function updateChannelMapping(id: string, updates: Partial<Omit<AudioChannelMapping, 'id'>>) {
    const index = channelMappings.value.findIndex(m => m.id === id)
    if (index >= 0) {
      channelMappings.value[index] = { ...channelMappings.value[index], ...updates }
      saveMappings()
    }
  }

  function deleteChannelMapping(id: string) {
    channelMappings.value = channelMappings.value.filter(m => m.id !== id)
    saveMappings()
  }

  function clearChannelMappings() {
    channelMappings.value = []
    saveMappings()
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

    // Per-channel mappings
    channelMappings,
    addChannelMapping,
    updateChannelMapping,
    deleteChannelMapping,
    clearChannelMappings,

    // Controls
    toggle,
    setBand,
    setSensitivity,
    setMinLevel,

    // For external use
    applyAudioModulation,
    applyPresetAudioModulation,
  }
}
