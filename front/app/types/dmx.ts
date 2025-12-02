// ═══════════════════════════════════════════════════════════════
// FIXTURE PROFILE (device template)
// ═══════════════════════════════════════════════════════════════
export interface ChannelDefinition {
  offset: number
  name: string
  type: 'dimmer' | 'strobe' | 'color' | 'other'
  min: number
  max: number
  defaultValue: number
}

export interface FixtureProfile {
  id: string
  name: string
  channelCount: number
  channels: ChannelDefinition[]
}

// ═══════════════════════════════════════════════════════════════
// FIXTURE (physical device instance)
// ═══════════════════════════════════════════════════════════════
export interface Fixture {
  id: string
  name: string
  profileId: string
  startChannel: number
  tags: string[]
}

// ═══════════════════════════════════════════════════════════════
// FIXTURE VALUES (channel values for a fixture)
// ═══════════════════════════════════════════════════════════════
export type StrobeSpeed = 'slow' | 'medium' | 'fast'

export interface FixtureValues {
  dimmer: number                  // 0-255 (maps to 9-134 for pinspot)
  strobe: boolean                 // Strobe mode on/off
  strobeSpeed: StrobeSpeed        // When strobe=true
  red: number                     // 0-255
  green: number                   // 0-255
  blue: number                    // 0-255
  white: number                   // 0-255
}

// ═══════════════════════════════════════════════════════════════
// PRESET (saved look for ONE fixture)
// ═══════════════════════════════════════════════════════════════
export interface Preset {
  id: string
  name: string
  fixtureId: string
  values: FixtureValues
}

// ═══════════════════════════════════════════════════════════════
// SCENE (stack of presets = all fixtures at one moment)
// ═══════════════════════════════════════════════════════════════
export interface Scene {
  id: string
  name: string
  presetIds: string[]             // Presets to stack (one per fixture max)
}

// ═══════════════════════════════════════════════════════════════
// BANK (timed grid of scenes)
// ═══════════════════════════════════════════════════════════════
export interface Bank {
  id: string
  name: string
  length: number                  // Total beats: 2, 4, 8, 16
  unitDuration: number            // Beat per cell: 1, 0.5, 0.25
  cells: (string | null)[]        // Scene ID or null for each cell
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT PROFILE
// ═══════════════════════════════════════════════════════════════
export const PINSPOT_RGBW: FixtureProfile = {
  id: 'pinspot-rgbw-5ch',
  name: 'PinSpot LED RGBW',
  channelCount: 5,
  channels: [
    { offset: 0, name: 'Master/Strobe', type: 'dimmer', min: 0, max: 255, defaultValue: 134 },
    // Channel 0 values: 0-8=off, 9-134=dimmer, 135-239=strobe, 240-255=full
    { offset: 1, name: 'Red', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 2, name: 'Green', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 3, name: 'Blue', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 4, name: 'White', type: 'color', min: 0, max: 255, defaultValue: 0 },
  ],
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function createDefaultValues(): FixtureValues {
  return {
    dimmer: 200,
    strobe: false,
    strobeSpeed: 'medium',
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
  }
}

export function createDefaultBank(): Omit<Bank, 'id'> {
  return {
    name: 'New Bank',
    length: 8,
    unitDuration: 1,
    cells: Array(8).fill(null),
  }
}

// Convert FixtureValues to DMX channel array (for PinSpot)
export function valuesToDMX(values: FixtureValues): number[] {
  let ch0: number

  if (values.strobe) {
    // Strobe mode: 135-239 range
    switch (values.strobeSpeed) {
      case 'slow':
        ch0 = 150
        break
      case 'medium':
        ch0 = 180
        break
      case 'fast':
        ch0 = 220
        break
    }
  } else {
    // Dimmer mode: map 0-255 to 9-134
    ch0 = Math.round(9 + (values.dimmer / 255) * 125)
  }

  return [ch0, values.red, values.green, values.blue, values.white]
}

// Get preview color from values (for UI display)
export function getPreviewColor(values: FixtureValues): string {
  const { red, green, blue, white } = values
  const r = Math.min(255, red + white * 0.5)
  const g = Math.min(255, green + white * 0.5)
  const b = Math.min(255, blue + white * 0.5)
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}
