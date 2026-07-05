// ═══════════════════════════════════════════════════════════════
// SPATIAL (for the 3D visualizer / virtual stage)
// ═══════════════════════════════════════════════════════════════
export interface Vec3 {
  x: number
  y: number
  z: number
}

// Visual archetype, drives how the 3D visualizer draws a fixture
export type FixtureType = 'pinspot' | 'par' | 'strobe' | 'moving-head' | 'laser'

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
  fixtureType?: FixtureType        // Visual archetype for the 3D visualizer
  beamAngle?: number               // Cone half-angle in degrees (for the beam render)
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
  // Spatial layout for the 3D visualizer (room-space, meters / Euler degrees).
  // Optional -> fully backward compatible with stored v3 data; auto-placed when absent.
  position?: Vec3                  // x: left-right, y: up, z: depth (toward audience)
  rotation?: Vec3                  // Euler degrees; aim direction of the fixture
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
// STAGE (virtual room for the 3D visualizer)
// ═══════════════════════════════════════════════════════════════
export interface Stage {
  width: number                   // X span in meters (left-right)
  depth: number                   // Z span in meters (front-back)
  height: number                  // Y span in meters (floor-ceiling)
}

export const DEFAULT_STAGE: Stage = {
  width: 6,
  depth: 4,
  height: 5, // taller room: lets fixtures hang high so beams read as long tubes
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
export type AudioBand = 'bass' | 'mid' | 'high'

// Easing curve types for audio reactive
export type AudioCurve = 'square' | 'linear' | 'sine'

// Audio reactive settings for a preset
export interface PresetAudioReactive {
  enabled: boolean
  band: AudioBand                 // Which frequency band to follow
  channel: number                 // Channel offset to modulate (0=dimmer, 1=R, etc.)
  threshold: number               // Min audio level to start reacting (0-100%)
  min: number                     // Output intensity min (0-100%)
  max: number                     // Output intensity max (0-100%)
  curve: AudioCurve               // Response curve shape
}

export interface Preset {
  id: string
  name: string
  profileId: string               // Linked to PROFILE, not device
  values?: PresetValues           // For RGBW profiles (backwards compat)
  channelValues?: number[]        // For non-RGBW profiles (Laser, etc.)
  isBuiltIn: boolean              // System presets vs user-created
  category: PresetCategory
  audioReactive?: PresetAudioReactive  // Optional audio-reactive modulation
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
  subdivision?: number            // Grid resolution to restore (so half-beat clips survive a roundtrip)
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
  startBeat: number               // Position in beats, 1-indexed. May be fractional (1, 1.5, ...) when the set subdivision > 1.
  duration: number                // Length in beats. May be fractional (e.g. 0.5) at higher subdivisions.
  // Future: fadeIn, fadeOut, endPresetId
}

export interface Set {
  id: string
  name: string
  length: SetLength               // Total beats: 1, 2, 4, 8, 16, 32
  subdivision?: number            // Steps per beat for the grid (1 = beats, 2 = half-beats). Default 1. Same length/BPM, finer grid.
  tags?: string[]                 // Section tags (Intro/Buildup/Drop...) for Perform filtering
  tracks: SetTrack[]              // Vertical lanes
  clips: SetClip[]                // Clips placed on timeline
}

// Predefined EDM section tags (free-text custom tags also allowed).
export const SET_SECTION_TAGS = ['Intro', 'Buildup', 'Drop', 'FX', 'Breakdown', 'Variation', 'Mid'] as const

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
  fixtureType: 'pinspot',
  beamAngle: 7, // tight "tube" beam (pinspots are narrow); was 12 = too splayed
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
  fixtureType: 'laser',
  beamAngle: 4,
  channels: [
    { offset: 0, name: 'Mode', type: 'other', min: 0, max: 255, defaultValue: 64, description: '0-63:OFF | 64-127:Manual | 128-191:Auto | 192-255:Sound' },
    { offset: 1, name: 'Pattern', type: 'other', min: 0, max: 255, defaultValue: 0, description: '51 patterns (0-255)' },
    { offset: 2, name: 'Rotation', type: 'other', min: 0, max: 255, defaultValue: 0, description: '0-127:angle | 128-191:CW | 192-255:CCW' },
    { offset: 3, name: 'H. Flip', type: 'other', min: 0, max: 255, defaultValue: 0, description: '0-127:position | 128-255:speed' },
    { offset: 4, name: 'V. Flip', type: 'other', min: 0, max: 255, defaultValue: 0, description: '0-127:position | 128-255:speed' },
    { offset: 5, name: 'H. Pos', type: 'other', min: 0, max: 255, defaultValue: 128, description: '0-127:position | 128-255:move speed' },
    { offset: 6, name: 'V. Pos', type: 'other', min: 0, max: 255, defaultValue: 128, description: '0-127:position | 128-255:move speed' },
    { offset: 7, name: 'Size', type: 'other', min: 0, max: 255, defaultValue: 64, description: '0-63:fixed | 64-127:grow | 128-191:shrink | 192-255:zoom' },
    { offset: 8, name: 'Color', type: 'other', min: 0, max: 255, defaultValue: 0, description: '0-63:mono | 64-127:mix | 128-191:auto mono | 192-255:auto' },
    { offset: 9, name: 'Dots', type: 'other', min: 0, max: 255, defaultValue: 0, description: '0-127:dots+lines | 128-255:dots only' },
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
    values: { dimmer: 255, strobe: true, strobeSpeed: 'slow', red: 255, green: 255, blue: 255, white: 0 } },
  { id: 'builtin-strobe-med', name: 'Strobe Med', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'medium', red: 255, green: 255, blue: 255, white: 0 } },
  { id: 'builtin-strobe-fast', name: 'Strobe Fast', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'strobe',
    values: { dimmer: 255, strobe: true, strobeSpeed: 'fast', red: 255, green: 255, blue: 255, white: 0 } },

  // Dimmers - only set dimmer channel, colors stay at 0 (don't override current color)
  { id: 'builtin-dim-25', name: '25%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 64, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 0, white: 0 } },
  { id: 'builtin-dim-50', name: '50%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 128, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 0, white: 0 } },
  { id: 'builtin-dim-75', name: '75%', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 192, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 0, white: 0 } },
  { id: 'builtin-full', name: 'Full', profileId: 'pinspot-rgbw-5ch', isBuiltIn: true, category: 'dimmer',
    values: { dimmer: 255, strobe: false, strobeSpeed: 'medium', red: 0, green: 0, blue: 0, white: 0 } },
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

export function createDefaultAudioReactive(): PresetAudioReactive {
  return {
    enabled: false,
    band: 'bass',
    channel: 0,        // Dimmer channel
    threshold: 0,      // No threshold (react to any level)
    min: 0,            // Output from 0%
    max: 100,          // Output to 100%
    curve: 'linear',   // Linear response
  }
}

export function createDefaultSet(): Omit<Set, 'id'> {
  return {
    name: 'New Set',
    length: 8,
    subdivision: 1,
    tags: [],
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

// ═══════════════════════════════════════════════════════════════
// PINSPOT DIMMER/STROBE BANDS (channel 0 semantics) - single source of truth
// Ch0: 0-8 off | 9-134 dimmer | 135-239 strobe (slow->fast) | 240-255 full
// ═══════════════════════════════════════════════════════════════
export const DMX_OFF_MAX = 8
export const DIMMER_MIN = 9
export const DIMMER_MAX = 134
export const STROBE_MIN = 135
export const STROBE_MAX = 239
export const FULL_MIN = 240

// Canonical strobe ch0 values per speed. Spans the 135-239 strobe band.
// NOTE: tune against real PinSpot hardware - these are reasonable defaults, not measured.
export const STROBE_DMX: Record<StrobeSpeed, number> = {
  slow: 150,
  medium: 190,
  fast: 230,
}

// Convert a 0-255 logical dimmer into the pinspot 9-134 ch0 band.
export function dimmerToCh0(dimmer: number): number {
  return Math.round(DIMMER_MIN + (Math.max(0, Math.min(255, dimmer)) / 255) * (DIMMER_MAX - DIMMER_MIN))
}

// Convert PresetValues to DMX channel array (for PinSpot)
export function valuesToDMX(values: PresetValues): number[] {
  const ch0 = values.strobe ? STROBE_DMX[values.strobeSpeed] : dimmerToCh0(values.dimmer)
  return [ch0, values.red, values.green, values.blue, values.white]
}

// ═══════════════════════════════════════════════════════════════
// FIXTURE DECODE (pure) - turn a raw DMX frame into a renderable state.
// The 3D visualizer AND hardware agree on this interpretation. It mirrors
// the dimmer/strobe band logic used by the player's master-dimmer pass.
// ═══════════════════════════════════════════════════════════════
export interface FixtureState {
  intensity01: number              // 0-1 overall brightness (the dimmer)
  rgb: [number, number, number]    // 0-255 raw color channels
  white: number                    // 0-255
  strobe: boolean
  strobeSpeed01: number            // 0 (slow) .. 1 (fast); 0 when not strobing
  active: boolean                  // true if the fixture emits anything
}

export function decodeFixture(frame: number[], device: Device, profile: DeviceProfile): FixtureState {
  const start = device.startChannel - 1
  const ch = (offset: number): number => frame[start + offset] ?? 0

  if (profile.controlType === 'rgbw') {
    const ch0 = ch(0)
    const r = ch(1), g = ch(2), b = ch(3), w = ch(4)

    let intensity01 = 0
    let strobe = false
    let strobeSpeed01 = 0

    if (ch0 >= STROBE_MIN && ch0 <= STROBE_MAX) {
      strobe = true
      strobeSpeed01 = (ch0 - STROBE_MIN) / (STROBE_MAX - STROBE_MIN)
      intensity01 = 1 // in strobe mode the RGB channels carry the level
    } else if (ch0 >= FULL_MIN) {
      intensity01 = 1
    } else if (ch0 >= DIMMER_MIN) {
      intensity01 = (ch0 - DIMMER_MIN) / (DIMMER_MAX - DIMMER_MIN)
    }

    const hasColor = r > 0 || g > 0 || b > 0 || w > 0
    return {
      intensity01,
      rgb: [r, g, b],
      white: w,
      strobe,
      strobeSpeed01,
      active: intensity01 > 0 && (hasColor || strobe),
    }
  }

  // Non-RGBW (sliders, e.g. laser): best-effort representation.
  // Derive a hue from a "Color" channel if present, intensity from any non-zero output.
  const colorCh = profile.channels.find(c => c.name === 'Color')
  const colorVal = colorCh ? ch(colorCh.offset) : 0
  const [r, g, b] = hslToRgb((colorVal / 255) * 360, 0.8, 0.5)
  const anyOutput = profile.channels.some(c => ch(c.offset) > 0)
  return {
    intensity01: anyOutput ? 1 : 0,
    rgb: [r, g, b],
    white: 0,
    strobe: false,
    strobeSpeed01: 0,
    active: anyOutput,
  }
}

// Small HSL->RGB (0-255) helper for non-RGBW fixture color approximation.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
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
  if (preset.values) {
    return getPreviewColor(preset.values)
  }
  return getPresetDisplayColor(preset)
}

// ═══════════════════════════════════════════════════════════════
// GENERIC PRESET HELPERS (for non-RGBW profiles)
// ═══════════════════════════════════════════════════════════════

// Convert preset to DMX channel array (works for any profile)
export function presetToChannels(preset: Preset): number[] {
  // If preset has RGBW values, convert using valuesToDMX
  if (preset.values) {
    return valuesToDMX(preset.values)
  }
  // If preset has generic channel values, return them directly
  if (preset.channelValues) {
    return [...preset.channelValues]
  }
  // Fallback: return empty array
  return []
}

// Get display color for preset (for grid clip display)
export function getPresetDisplayColor(preset: Preset): string {
  const profile = getProfileById(preset.profileId)

  // For RGBW profiles, use existing color logic
  if (profile?.controlType === 'rgbw' && preset.values) {
    return getPreviewColor(preset.values)
  }

  // For slider profiles, try to derive color from a "Color" channel
  if (preset.channelValues && profile?.controlType === 'sliders') {
    const colorChannel = profile.channels.find(c => c.name === 'Color')
    if (colorChannel) {
      const colorValue = preset.channelValues[colorChannel.offset] || 0
      // Map 0-255 to hue 0-360
      const hue = (colorValue / 255) * 360
      return `hsl(${hue}, 70%, 50%)`
    }
  }

  // Default purple for unknown profiles
  return '#8b5cf6'
}

// Create default channel values for a profile
export function createDefaultChannelValues(profileId: string): number[] {
  const profile = getProfileById(profileId)
  if (!profile) return []
  return profile.channels.map(ch => ch.defaultValue)
}
