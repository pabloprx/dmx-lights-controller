// Pure audio-reactive math, extracted so it can be unit tested without Nuxt globals.
// mirrors app/composables/useAudioReactive.ts:121-143

import type { AudioCurve } from '~/types/dmx'

// Apply a response curve to a normalized value (0-1 input, 0-1 output).
// mirrors useAudioReactive.ts:131-143
export function applyCurve(value: number, curve: AudioCurve): number {
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

// Convert a percentage (0-100) to a DMX value based on channel type.
// Dimmer channel (offset 0) maps to PinSpot 9-134; other channels map to 0-255.
// mirrors useAudioReactive.ts:121-128
export function percentToDMX(percent: number, channelOffset: number): number {
  if (channelOffset === 0) {
    // Dimmer channel: 9-134 range (PinSpot)
    return Math.round(9 + (percent / 100) * 125)
  }
  // RGB/W channels: 0-255
  return Math.round((percent / 100) * 255)
}
