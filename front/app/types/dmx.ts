// ═══════════════════════════════════════════════════════════════
// DEVICE PROFILE (template for a type of fixture)
// ═══════════════════════════════════════════════════════════════
export interface ChannelRange {
  min: number
  max: number
  label: string
}

export interface ChannelDefinition {
  offset: number
  name: string
  type: 'dimmer' | 'strobe' | 'color' | 'other'
  min: number
  max: number
  defaultValue: number
  description?: string
  ranges?: ChannelRange[]  // For channels with multiple function ranges
}

export type ProfileControlType = 'rgbw' | 'sliders'

export interface DeviceProfile {
  id: string
  name: string
  channelCount: number
  channels: ChannelDefinition[]
  controlType: ProfileControlType  // Determines UI: color pads vs sliders
}

// ═══════════════════════════════════════════════════════════════
// DEVICE (physical fixture instance - simplified from old Fixture)
// ═══════════════════════════════════════════════════════════════
export interface Device {
  id: string
  name: string                    // e.g., "Pinspot 1"
  profileId: string               // Reference to DeviceProfile
  startChannel: number            // DMX address (1-512)
  tags: string[]                  // For filtering/organization
}

// ═══════════════════════════════════════════════════════════════
// GROUP (collection of devices that act together)
// ═══════════════════════════════════════════════════════════════
export interface Group {
  id: string
  name: string                    // e.g., "Left Lights", "Red Strobes"
  profileId: string               // All devices MUST share same profile
  deviceIds: string[]             // Devices in this group
  color: string                   // UI color for track identification
}

// ═══════════════════════════════════════════════════════════════
// PRESET VALUES (channel values configuration)
// ═══════════════════════════════════════════════════════════════
export type StrobeSpeed = 'slow' | 'medium' | 'fast'

export interface PresetValues {
  dimmer: number                  // 0-255 (maps to 9-134 for pinspot)
  strobe: boolean                 // Strobe mode on/off
  strobeSpeed: StrobeSpeed        // When strobe=true
  red: number                     // 0-255
  green: number                   // 0-255
  blue: number                    // 0-255
  white: number                   // 0-255
}

// ═══════════════════════════════════════════════════════════════
// PRESET (profile-linked, shared across devices of same type)
// ═══════════════════════════════════════════════════════════════
export type PresetCategory = 'color' | 'strobe' | 'dimmer' | 'custom'

export interface Preset {
  id: string
  name: string
  profileId: string               // Linked to PROFILE, not device
  values: PresetValues
  isBuiltIn: boolean              // System presets vs user-created
  category: PresetCategory
}

// ═══════════════════════════════════════════════════════════════
// SCENE (blueprint template - reusable track + clip configurations)
// Scenes are like "mini-Set templates" that can be loaded into any Set
// ═══════════════════════════════════════════════════════════════
export interface SceneTrack {
  id: string
  name: string
  targetType: 'device' | 'group'
  targetId: string                // deviceId or groupId
  color: string
}

export interface SceneClip {
  id: string
  trackId: string                 // Reference to SceneTrack.id
  presetId: string
  startBeat: number
  duration: number
}

export interface Scene {
  id: string
  name: string
  length: SetLength                // Beat length of the scene template
  tracks: SceneTrack[]            // Track definitions
  clips: SceneClip[]              // Clip placements
}

// ═══════════════════════════════════════════════════════════════
// SET (FL Playlist-style: tracks × time) - replaces Bank
// ═══════════════════════════════════════════════════════════════
export type SetLength = 1 | 2 | 4 | 8 | 16 | 32

export interface SetTrack {
  id: string
  name: string                    // e.g., "Left Lights", "Lazer"
  targetType: 'device' | 'group'
  targetId: string                // deviceId or groupId
  color: string                   // Track color for UI
  muted: boolean
  solo: boolean
}

export interface SetClip {
  id: string
  trackId: string
  presetId: string                // The preset to apply
  startBeat: number               // Position in beats (0-indexed)
  duration: number                // Length in beats
  // Future: fadeIn, fadeOut, endPresetId
}

export interface Set {
  id: string
  name: string
  length: SetLength               // Total beats: 1, 2, 4, 8, 16, 32
  tracks: SetTrack[]              // Vertical lanes
  clips: SetClip[]                // Clips placed on timeline
}

// ═══════════════════════════════════════════════════════════════
// PLAYLIST (ordered Sets queue - like Spotify)
// ═══════════════════════════════════════════════════════════════
export interface PlaylistEntry {
  id: string
  setId: string
  repeatCount: number             // How many times to repeat (1 = play once)
}

export interface Playlist {
  id: string
  name: string
  entries: PlaylistEntry[]
  loopPlaylist: boolean           // Loop entire playlist when done
}

// ═══════════════════════════════════════════════════════════════
// DEVICE PROFILES
// ═══════════════════════════════════════════════════════════════
export const PINSPOT_RGBW: DeviceProfile = {
  id: 'pinspot-rgbw-5ch',
  name: 'PinSpot 15W RGBW',
  channelCount: 5,
  controlType: 'rgbw',
  channels: [
    {
      offset: 0,
      name: 'Dimmer/Strobe',
      type: 'dimmer',
      min: 0,
      max: 255,
      defaultValue: 134,
      ranges: [
        { min: 0, max: 8, label: 'Off' },
        { min: 9, max: 134, label: 'Dimmer' },
        { min: 135, max: 239, label: 'Strobe (slow-fast)' },
        { min: 240, max: 255, label: 'Full' },
      ],
    },
    { offset: 1, name: 'Red', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 2, name: 'Green', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 3, name: 'Blue', type: 'color', min: 0, max: 255, defaultValue: 0 },
    { offset: 4, name: 'White', type: 'color', min: 0, max: 255, defaultValue: 0 },
  ],
}

export const LASER_10CH: DeviceProfile = {
  id: 'laser-10ch',
  name: 'Laser 10ch',
  channelCount: 10,
  controlType: 'sliders',
  channels: [
    { offset: 0, name: 'Mode', type: 'other', min: 0, max: 255, defaultValue: 64, description: 'Manual mode = 64' },
    { offset: 1, name: 'Patterns', type: 'other', min: 0, max: 255, defaultValue: 0 },
    { offset: 2, name: 'Rotation', type: 'other', min: 0, max: 255, defaultValue: 0 },
    { offset: 3, name: 'H. Control', type: 'other', min: 0, max: 255, defaultValue: 0 },
    { offset: 4, name: 'V. Control', type: 'other', min: 0, max: 255, defaultValue: 0 },
    { offset: 5, name: 'H. Position', type: 'other', min: 0, max: 255, defaultValue: 128 },
    { offset: 6, name: 'V. Position', type: 'other', min: 0, max: 255, defaultValue: 128 },
    { offset: 7, name: 'Size', type: 'other', min: 0, max: 255, defaultValue: 128 },
    { offset: 8, name: 'Color', type: 'other', min: 0, max: 255, defaultValue: 0 },
    { offset: 9, name: 'Beam', type: 'other', min: 0, max: 255, defaultValue: 255 },
  ],
}

// All available device profiles
export const DEVICE_PROFILES: DeviceProfile[] = [PINSPOT_RGBW, LASER_10CH]

// Helper to get profile by ID
export function getProfileById(profileId: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find(p => p.id === profileId)
}

// ═══════════════════════════════════════════════════════════════
// BUILT-IN PRESETS (for pinspot-rgbw-5ch profile)
// ═══════════════════════════════════════════════════════════════
export const BUILT_IN_PRESETS: Preset[] = [
  // Colors
  { id: 'builtin-red', name: 'Red', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 255, green: 0, blue: 0, white: 0 } },
  { id: 'builtin-green', name: 'Green', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 0, green: 255, blue: 0, white: 0 } },
  { id: 'builtin-blue', name: 'Blue', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 255, white: 0 } },
  { id: 'builtin-white', name: 'White', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 0, white: 255 } },
  { id: 'builtin-cyan', name: 'Cyan', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 0, green: 255, blue: 255, white: 0 } },
  { id: 'builtin-magenta', name: 'Magenta', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 255, green: 0, blue: 255, white: 0 } },
  { id: 'builtin-yellow', name: 'Yellow', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 255, green: 255, blue: 0, white: 0 } },
  { id: 'builtin-orange', name: 'Orange', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'color',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 255, green: 128, blue: 0, white: 0 } },

  // Strobes
  { id: 'builtin-strobe-slow', name: 'Strobe Slow', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'slow', red: 255, green: 255, blue: 255, white: 255 } },
  { id: 'builtin-strobe-med', name: 'Strobe Med', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 255 } },
  { id: 'builtin-strobe-fast', name: 'Strobe Fast', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'fast', red: 255, green: 255, blue: 255, white: 255 } },

  // Dimmers
  { id: 'builtin-dim-25', name: '25%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 64, strobe: false, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 255 } },
  { id: 'builtin-dim-50', name: '50%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 128, strobe: false, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 255 } },
  { id: 'builtin-dim-75', name: '75%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 192, strobe: false, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 255 } },
  { id: 'builtin-full', name: 'Full', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 255 } },
]

// ═══════════════════════════════════════════════════════════════
// TRACK COLORS (for UI)
// ═══════════════════════════════════════════════════════════════
export const TRACK_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function createDefaultValues(): PresetValues {
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

export function createDefaultSet(): Omit<Set, 'id'> {
  return {
    name: 'New Set',
    length: 8,
    tracks: [],
    clips: [],
  }
}

export function createDefaultTrack(
  targetType: 'device' | 'group',
  targetId: string,
  name: string,
  colorIndex: number = 0
): Omit<SetTrack, 'id'> {
  return {
    name,
    targetType,
    targetId,
    color: TRACK_COLORS[colorIndex % TRACK_COLORS.length],
    muted: false,
    solo: false,
  }
}

// Convert PresetValues to DMX channel array (for PinSpot)
export function valuesToDMX(values: PresetValues): number[] {
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
export function getPreviewColor(values: PresetValues): string {
  const { red, green, blue, white } = values
  const r = Math.min(255, red + white * 0.5)
  const g = Math.min(255, green + white * 0.5)
  const b = Math.min(255, blue + white * 0.5)
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

// Get preset color for UI (simpler - just returns the color hex)
export function getPresetColor(preset: Preset): string {
  return getPreviewColor(preset.values)
}
