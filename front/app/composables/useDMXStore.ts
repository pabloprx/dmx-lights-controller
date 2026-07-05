import { ref, computed, watch, toRaw } from 'vue'
import type {
  DeviceProfile, Device, Group, Preset, Scene, SceneTrack, SceneClip,
  Set, SetTrack, SetClip, Playlist, PresetValues, SetLength, Stage, Vec3
} from '~/types/dmx'
import {
  DEVICE_PROFILES, BUILT_IN_PRESETS, TRACK_COLORS, DEFAULT_STAGE, STROBE_DMX,
  generateId, createDefaultSet, getProfileById, presetToChannels, dimmerToCh0
} from '~/types/dmx'
import { VJ_PRESETS, VJ_SET_NAMES, LEGACY_VJ_SET_NAMES, buildVjSetPack } from '~/lib/vjSetPack'
import { masterDimmer } from './useSetPlayer'

const STORAGE_KEY = 'dmx-store-v3'

// ═══════════════════════════════════════════════════════════════
// SHARED STATE (singleton)
// ═══════════════════════════════════════════════════════════════
const profiles = ref<DeviceProfile[]>(DEVICE_PROFILES)
const devices = ref<Device[]>([])
const groups = ref<Group[]>([])
const presets = ref<Preset[]>([...BUILT_IN_PRESETS]) // Start with built-in
const scenes = ref<Scene[]>([])
const sets = ref<Set[]>([])
const playlists = ref<Playlist[]>([])

// Virtual stage/room for the 3D visualizer
const stage = ref<Stage>({ ...DEFAULT_STAGE })

// Keep room dimensions sane (meters). Guards against bad/stale stored values.
function clampStage(s: Partial<Stage>): Stage {
  const c = (v: number | undefined, lo: number, hi: number, def: number) =>
    Math.max(lo, Math.min(hi, typeof v === 'number' && Number.isFinite(v) ? v : def))
  return {
    width: c(s.width, 2, 30, DEFAULT_STAGE.width),
    depth: c(s.depth, 2, 30, DEFAULT_STAGE.depth),
    height: c(s.height, 2, 15, DEFAULT_STAGE.height),
  }
}

// Selection state
const selectedDeviceId = ref<string | null>(null)
const selectedGroupId = ref<string | null>(null)
const selectedPresetId = ref<string | null>(null)
const selectedSceneId = ref<string | null>(null)
const selectedSetId = ref<string | null>(null)
const activeSetId = ref<string | null>(null) // Set currently playing

// Combined preset selection (color + effect)
// Color presets can combine with strobe/dimmer, but strobe and dimmer are mutually exclusive
const selectedColorPresetId = ref<string | null>(null)
const selectedEffectPresetId = ref<string | null>(null) // strobe OR dimmer

// Palette state (for painting clips)
const activeBrushId = ref<string | null>(null) // Currently selected preset for painting
const recentPresets = ref<string[]>([]) // Last 8 used presets
const toolMode = ref<'paint' | 'erase'>('paint') // Current tool mode

// Current DMX state tracking (for additive presets like dimmer)
// Stores RAW values before master dimmer scaling
const currentDMXState = ref<number[]>(new Array(100).fill(0))

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════
// Returns true if a saved payload existed (so the caller can tell "fresh install"
// apart from "user intentionally emptied everything" and not re-seed the latter).
function loadFromStorage(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      devices.value = data.devices || []
      groups.value = data.groups || []
      // Merge user presets with built-in (don't duplicate built-in)
      const userPresets = (data.presets || []).filter((p: Preset) => !p.isBuiltIn)
      presets.value = [...BUILT_IN_PRESETS, ...userPresets]
      scenes.value = data.scenes || []
      // Per-set defaulting for fields added after v3 (no migration layer exists):
      // old stored sets lack subdivision/tags, which would yield NaN/crash on read.
      sets.value = (data.sets || []).map((s: Set) => ({
        ...s,
        subdivision: s.subdivision ?? 1,
        tags: s.tags ?? [],
      }))
      playlists.value = data.playlists || []
      activeSetId.value = data.activeSetId || null
      if (data.stage) stage.value = clampStage(data.stage)
      // Persist the normalized state so clamped/migrated values stick even
      // before the auto-save watch is registered.
      saveToStorage()
      return true
    }
  } catch (e) {
    console.error('[DMXStore] Failed to load from storage:', e)
  }
  return false
}

function saveToStorage() {
  if (typeof window === 'undefined') return

  try {
    // Serialize from the RAW objects, not the reactive proxies: stringify over
    // proxies pays a trap on every property access (hundreds of thousands for
    // a full set pack), which shows up as a main-thread freeze mid-performance.
    const data = {
      devices: toRaw(devices.value),
      groups: toRaw(groups.value),
      presets: toRaw(presets.value).filter(p => !p.isBuiltIn), // Only save user presets
      scenes: toRaw(scenes.value),
      sets: toRaw(sets.value),
      playlists: toRaw(playlists.value),
      activeSetId: activeSetId.value,
      stage: toRaw(stage.value),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[DMXStore] Failed to save to storage:', e)
  }
}

// Debounced save: coalesce bursts (paint strokes, pack loads, live tweaks)
// into one write. flushSave() runs a pending save NOW - wired to pagehide so
// a debounce window can't lose the last change on refresh/close.
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (typeof window === 'undefined') return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveToStorage()
  }, 400)
}
function flushSave() {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  saveToStorage()
}

// Auto-save: ONE module-level watcher for the whole app. This used to live
// inside useDMXStore(), so EVERY component calling the composable registered
// its own deep watcher over the entire store graph - one mutation then cost
// N full traversals of every set/clip/preset (~700ms main-thread freezes on
// set activation, frozen beat counter). Registered once here instead.
let autoSaveRegistered = false
function registerAutoSave() {
  if (autoSaveRegistered || typeof window === 'undefined') return
  autoSaveRegistered = true
  watch([devices, groups, presets, scenes, sets, playlists, activeSetId, stage], scheduleSave, { deep: true })
  window.addEventListener('pagehide', flushSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
}

export function useDMXStore() {
  // Initialize on first use
  if (devices.value.length === 0 && sets.value.length === 0 && typeof window !== 'undefined') {
    const hadStoredData = loadFromStorage()
    // Seed a starter rig + demo set ONLY on a truly fresh install (no storage
    // key). If the user deliberately emptied everything, leave it empty.
    if (!hadStoredData) {
      seedDefaults()
    }
  }

  // Auto-save on changes (module-level singleton; see registerAutoSave)
  registerAutoSave()

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════
  const selectedDevice = computed(() =>
    devices.value.find(d => d.id === selectedDeviceId.value) || null
  )

  const selectedGroup = computed(() =>
    groups.value.find(g => g.id === selectedGroupId.value) || null
  )

  const selectedPreset = computed(() =>
    presets.value.find(p => p.id === selectedPresetId.value) || null
  )

  const selectedScene = computed(() =>
    scenes.value.find(s => s.id === selectedSceneId.value) || null
  )

  const selectedSet = computed(() =>
    sets.value.find(s => s.id === selectedSetId.value) || null
  )

  const activeSet = computed(() =>
    sets.value.find(s => s.id === activeSetId.value) || null
  )

  // Get presets by profile (for preset picker)
  const presetsByProfile = computed(() => {
    const grouped = new Map<string, Preset[]>()
    for (const preset of presets.value) {
      const list = grouped.get(preset.profileId) || []
      list.push(preset)
      grouped.set(preset.profileId, list)
    }
    return grouped
  })

  // Get presets by category (for quick picker)
  const presetsByCategory = computed(() => {
    const colors = presets.value.filter(p => p.category === 'color')
    const strobes = presets.value.filter(p => p.category === 'strobe')
    const dimmers = presets.value.filter(p => p.category === 'dimmer')
    const custom = presets.value.filter(p => p.category === 'custom')
    return { colors, strobes, dimmers, custom }
  })

  // ═══════════════════════════════════════════════════════════════
  // DEVICE CRUD
  // ═══════════════════════════════════════════════════════════════
  // Auto-place a device on a tidy grid across the stage so it always renders
  // somewhere sensible in 3D even if added without the stage editor.
  function autoPlacePosition(index: number): Vec3 {
    const s = stage.value
    const perRow = Math.max(1, Math.min(8, Math.round(s.width)))
    const col = index % perRow
    const row = Math.floor(index / perRow)
    return {
      x: -s.width / 2 + (s.width / (perRow + 1)) * (col + 1),
      y: Math.min(s.height - 0.3, 2.4),
      z: -s.depth / 2 + 0.6 + row * 0.9,
    }
  }

  function addDevice(data: Omit<Device, 'id'>): Device {
    const device: Device = { id: generateId(), ...data }
    if (!device.position) device.position = autoPlacePosition(devices.value.length)
    devices.value.push(device)
    return device
  }

  // Update only the spatial transform of a device (used by the 3D stage editor)
  function updateDeviceTransform(id: string, transform: { position?: Vec3; rotation?: Vec3 }) {
    updateDevice(id, transform)
  }

  function setStage(partial: Partial<Stage>) {
    stage.value = clampStage({ ...stage.value, ...partial })
  }

  function updateDevice(id: string, data: Partial<Device>) {
    const idx = devices.value.findIndex(d => d.id === id)
    if (idx !== -1) {
      devices.value[idx] = { ...devices.value[idx], ...data }
    }
  }

  function deleteDevice(id: string) {
    devices.value = devices.value.filter(d => d.id !== id)
    // Remove from all groups
    for (const group of groups.value) {
      group.deviceIds = group.deviceIds.filter(did => did !== id)
    }
    // Remove tracks targeting this device
    for (const set of sets.value) {
      const trackIds = set.tracks.filter(t => t.targetType === 'device' && t.targetId === id).map(t => t.id)
      set.clips = set.clips.filter(c => !trackIds.includes(c.trackId))
      set.tracks = set.tracks.filter(t => !(t.targetType === 'device' && t.targetId === id))
    }
    if (selectedDeviceId.value === id) selectedDeviceId.value = null
  }

  function selectDevice(id: string | null) {
    selectedDeviceId.value = id
  }

  function getDevice(id: string): Device | null {
    return devices.value.find(d => d.id === id) || null
  }

  // ═══════════════════════════════════════════════════════════════
  // GROUP CRUD
  // ═══════════════════════════════════════════════════════════════
  function addGroup(data: Omit<Group, 'id'>): Group {
    const group: Group = { id: generateId(), ...data }
    groups.value.push(group)
    return group
  }

  function updateGroup(id: string, data: Partial<Group>) {
    const idx = groups.value.findIndex(g => g.id === id)
    if (idx !== -1) {
      groups.value[idx] = { ...groups.value[idx], ...data }
    }
  }

  function deleteGroup(id: string) {
    groups.value = groups.value.filter(g => g.id !== id)
    // Remove tracks targeting this group
    for (const set of sets.value) {
      const trackIds = set.tracks.filter(t => t.targetType === 'group' && t.targetId === id).map(t => t.id)
      set.clips = set.clips.filter(c => !trackIds.includes(c.trackId))
      set.tracks = set.tracks.filter(t => !(t.targetType === 'group' && t.targetId === id))
    }
    if (selectedGroupId.value === id) selectedGroupId.value = null
  }

  function selectGroup(id: string | null) {
    selectedGroupId.value = id
  }

  function getGroup(id: string): Group | null {
    return groups.value.find(g => g.id === id) || null
  }

  function getGroupDevices(groupId: string): Device[] {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return []
    return devices.value.filter(d => group.deviceIds.includes(d.id))
  }

  // ═══════════════════════════════════════════════════════════════
  // PRESET CRUD
  // ═══════════════════════════════════════════════════════════════
  function addPreset(data: Omit<Preset, 'id'>): Preset {
    const preset: Preset = { id: generateId(), ...data }
    presets.value.push(preset)
    return preset
  }

  function updatePreset(id: string, data: Partial<Preset>) {
    const preset = presets.value.find(p => p.id === id)
    if (preset && !preset.isBuiltIn) {
      const idx = presets.value.findIndex(p => p.id === id)
      presets.value[idx] = { ...preset, ...data }
    }
  }

  function deletePreset(id: string) {
    const preset = presets.value.find(p => p.id === id)
    if (preset?.isBuiltIn) return // Can't delete built-in

    presets.value = presets.value.filter(p => p.id !== id)
    // Remove clips using this preset
    for (const set of sets.value) {
      set.clips = set.clips.filter(c => c.presetId !== id)
    }
    if (selectedPresetId.value === id) selectedPresetId.value = null
  }

  function selectPreset(id: string | null) {
    selectedPresetId.value = id
  }

  function getPreset(id: string): Preset | null {
    return presets.value.find(p => p.id === id) || null
  }

  // Combined preset selection with smart merging
  // Color + Strobe can combine, but Strobe and Dimmer are mutually exclusive
  function selectColorPreset(presetId: string | null) {
    // Toggle off if clicking the same one
    if (selectedColorPresetId.value === presetId) {
      selectedColorPresetId.value = null
    } else {
      selectedColorPresetId.value = presetId
    }
    applyCombinedPreset()
  }

  function selectEffectPreset(presetId: string | null) {
    // Toggle off if clicking the same one
    if (selectedEffectPresetId.value === presetId) {
      selectedEffectPresetId.value = null
    } else {
      selectedEffectPresetId.value = presetId
    }
    applyCombinedPreset()
  }

  // Get combined preset values from color + effect selections
  function getCombinedPresetValues(): PresetValues | null {
    const colorPreset = selectedColorPresetId.value ? getPreset(selectedColorPresetId.value) : null
    const effectPreset = selectedEffectPresetId.value ? getPreset(selectedEffectPresetId.value) : null

    if (!colorPreset && !effectPreset) return null

    // Start with defaults
    const combined: PresetValues = {
      dimmer: 255,
      strobe: false,
      strobeSpeed: 'medium',
      red: 0,
      green: 0,
      blue: 0,
      white: 0
    }

    // Apply color values
    if (colorPreset?.values) {
      combined.red = colorPreset.values.red
      combined.green = colorPreset.values.green
      combined.blue = colorPreset.values.blue
      combined.white = colorPreset.values.white
      combined.dimmer = colorPreset.values.dimmer
    }

    // Apply effect (strobe or dimmer) - overrides dimmer settings
    if (effectPreset?.values) {
      combined.dimmer = effectPreset.values.dimmer
      combined.strobe = effectPreset.values.strobe
      combined.strobeSpeed = effectPreset.values.strobeSpeed
    }

    return combined
  }

  // Apply combined color + effect preset to selected device/group
  function applyCombinedPreset() {
    const values = getCombinedPresetValues()
    if (!values) return

    // Apply to selected device or group
    if (selectedDeviceId.value) {
      const device = getDevice(selectedDeviceId.value)
      if (device) {
        applyCombinedValuesToDevice(values, device)
      }
    } else if (selectedGroupId.value) {
      const group = getGroup(selectedGroupId.value)
      if (group) {
        for (const deviceId of group.deviceIds) {
          const device = getDevice(deviceId)
          if (device) {
            applyCombinedValuesToDevice(values, device)
          }
        }
      }
    }
  }

  // Helper to apply combined values to a device
  function applyCombinedValuesToDevice(values: PresetValues, device: Device) {
    const profile = getProfileById(device.profileId)
    if (!profile || profile.controlType !== 'rgbw') return

    const dmx = new Array(100).fill(0)
    const start = device.startChannel - 1

    // Apply to pinspot-rgbw-5ch profile
    // CH1: Dimmer/Strobe (shared constants - single source of truth in types/dmx.ts)
    dmx[start + 0] = values.strobe ? STROBE_DMX[values.strobeSpeed] : dimmerToCh0(values.dimmer)

    // CH2-5: RGBW
    dmx[start + 1] = values.red
    dmx[start + 2] = values.green
    dmx[start + 3] = values.blue
    dmx[start + 4] = values.white

    sendDMX(dmx)
  }

  function getPresetsForProfile(profileId: string): Preset[] {
    return presets.value.filter(p => p.profileId === profileId)
  }

  // ═══════════════════════════════════════════════════════════════
  // PALETTE / BRUSH (for painting clips)
  // ═══════════════════════════════════════════════════════════════

  // Active brush is the preset used when painting clips
  const activeBrush = computed(() =>
    activeBrushId.value ? getPreset(activeBrushId.value) : null
  )

  function setActiveBrush(presetId: string | null) {
    activeBrushId.value = presetId

    if (presetId) {
      // Add to recent presets (no duplicates, max 8)
      recentPresets.value = [
        presetId,
        ...recentPresets.value.filter(id => id !== presetId)
      ].slice(0, 8)

      // Live preview: apply to selected device or group
      if (selectedDeviceId.value) {
        applyPresetToDevice(presetId, selectedDeviceId.value)
      } else if (selectedGroupId.value) {
        const group = getGroup(selectedGroupId.value)
        if (group) {
          applyPresetToDevices(presetId, group.deviceIds)
        }
      }
    }
  }

  function setToolMode(mode: 'paint' | 'erase') {
    toolMode.value = mode
  }

  function toggleToolMode() {
    toolMode.value = toolMode.value === 'paint' ? 'erase' : 'paint'
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENE CRUD
  // ═══════════════════════════════════════════════════════════════
  function addScene(data: Omit<Scene, 'id'>): Scene {
    const scene: Scene = { id: generateId(), ...data }
    scenes.value.push(scene)
    return scene
  }

  function updateScene(id: string, data: Partial<Scene>) {
    const idx = scenes.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      scenes.value[idx] = { ...scenes.value[idx], ...data }
    }
  }

  function deleteScene(id: string) {
    scenes.value = scenes.value.filter(s => s.id !== id)
    if (selectedSceneId.value === id) selectedSceneId.value = null
  }

  function selectScene(id: string | null) {
    selectedSceneId.value = id
  }

  function getScene(id: string): Scene | null {
    return scenes.value.find(s => s.id === id) || null
  }

  // Save current Set as a Scene blueprint
  function saveSetAsScene(setId: string, sceneName: string): Scene | null {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return null

    // Create scene tracks from set tracks (with new IDs)
    const trackIdMap = new Map<string, string>() // old trackId -> new trackId
    const sceneTracks: SceneTrack[] = set.tracks.map(track => {
      const newId = generateId()
      trackIdMap.set(track.id, newId)
      return {
        id: newId,
        name: track.name,
        targetType: track.targetType,
        targetId: track.targetId,
        color: track.color,
      }
    })

    // Create scene clips with remapped track IDs
    const sceneClips: SceneClip[] = set.clips.map(clip => ({
      id: generateId(),
      trackId: trackIdMap.get(clip.trackId) || clip.trackId,
      presetId: clip.presetId,
      startBeat: clip.startBeat,
      duration: clip.duration,
    }))

    const scene: Scene = {
      id: generateId(),
      name: sceneName,
      length: set.length,
      subdivision: set.subdivision ?? 1,
      tracks: sceneTracks,
      clips: sceneClips,
    }
    scenes.value.push(scene)
    return scene
  }

  // Load a Scene blueprint into a Set (replaces existing tracks/clips)
  function loadSceneToSet(setId: string, sceneId: string): boolean {
    const set = sets.value.find(s => s.id === setId)
    const scene = scenes.value.find(s => s.id === sceneId)
    if (!set || !scene) return false

    // Create set tracks from scene tracks (with new IDs)
    const trackIdMap = new Map<string, string>() // scene trackId -> new set trackId
    const newTracks: SetTrack[] = scene.tracks.map(sceneTrack => {
      const newId = generateId()
      trackIdMap.set(sceneTrack.id, newId)
      return {
        id: newId,
        name: sceneTrack.name,
        targetType: sceneTrack.targetType,
        targetId: sceneTrack.targetId,
        color: sceneTrack.color,
        muted: false,
        solo: false,
      }
    })

    // Create set clips with remapped track IDs
    const newClips: SetClip[] = scene.clips.map(sceneClip => ({
      id: generateId(),
      trackId: trackIdMap.get(sceneClip.trackId) || sceneClip.trackId,
      presetId: sceneClip.presetId,
      startBeat: sceneClip.startBeat,
      duration: sceneClip.duration,
    }))

    // Replace set tracks and clips (use splice to ensure reactivity)
    set.tracks.splice(0, set.tracks.length, ...newTracks)
    set.clips.splice(0, set.clips.length, ...newClips)
    set.length = scene.length
    set.subdivision = scene.subdivision ?? 1 // restore grid resolution so half-beat clips stay reachable

    // Force reactivity by triggering the sets array
    const idx = sets.value.findIndex(s => s.id === setId)
    if (idx !== -1) {
      sets.value.splice(idx, 1, { ...set })
    }

    return true
  }

  // ═══════════════════════════════════════════════════════════════
  // SET CRUD
  // ═══════════════════════════════════════════════════════════════
  function addSet(data?: Partial<Omit<Set, 'id'>>): Set {
    const defaults = createDefaultSet()
    const set: Set = {
      id: generateId(),
      name: data?.name || defaults.name,
      length: data?.length || defaults.length,
      subdivision: data?.subdivision ?? defaults.subdivision,
      tags: data?.tags ?? defaults.tags,
      tracks: data?.tracks || defaults.tracks,
      clips: data?.clips || defaults.clips,
    }
    sets.value.push(set)
    return set
  }

  function updateSet(id: string, data: Partial<Set>) {
    const idx = sets.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      sets.value[idx] = { ...sets.value[idx], ...data }
    }
  }

  function deleteSet(id: string) {
    sets.value = sets.value.filter(s => s.id !== id)
    // Remove from playlists
    for (const playlist of playlists.value) {
      playlist.entries = playlist.entries.filter(e => e.setId !== id)
    }
    if (selectedSetId.value === id) selectedSetId.value = null
    if (activeSetId.value === id) activeSetId.value = null
  }

  function selectSet(id: string | null) {
    selectedSetId.value = id
  }

  function setActiveSet(id: string | null) {
    activeSetId.value = id
  }

  // ═══════════════════════════════════════════════════════════════
  // SET TRACK OPERATIONS
  // ═══════════════════════════════════════════════════════════════
  function addTrackToSet(setId: string, targetType: 'device' | 'group', targetId: string): SetTrack | null {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return null

    const target = targetType === 'device' ? getDevice(targetId) : getGroup(targetId)
    if (!target) return null

    const track: SetTrack = {
      id: generateId(),
      name: target.name,
      targetType,
      targetId,
      color: TRACK_COLORS[set.tracks.length % TRACK_COLORS.length],
      muted: false,
      solo: false,
    }
    set.tracks.push(track)
    return track
  }

  function updateTrack(setId: string, trackId: string, data: Partial<SetTrack>) {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return

    const idx = set.tracks.findIndex(t => t.id === trackId)
    if (idx !== -1) {
      set.tracks[idx] = { ...set.tracks[idx], ...data }
    }
  }

  function deleteTrack(setId: string, trackId: string) {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return

    set.tracks = set.tracks.filter(t => t.id !== trackId)
    set.clips = set.clips.filter(c => c.trackId !== trackId)
  }

  // ═══════════════════════════════════════════════════════════════
  // SET CLIP OPERATIONS
  // ═══════════════════════════════════════════════════════════════
  function addClipToSet(setId: string, trackId: string, presetId: string, startBeat: number, duration: number = 1): SetClip | null {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return null

    const track = set.tracks.find(t => t.id === trackId)
    if (!track) return null

    const clip: SetClip = {
      id: generateId(),
      trackId,
      presetId,
      startBeat,
      duration,
    }
    set.clips.push(clip)
    return clip
  }

  function updateClip(setId: string, clipId: string, data: Partial<SetClip>) {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return

    const idx = set.clips.findIndex(c => c.id === clipId)
    if (idx !== -1) {
      set.clips[idx] = { ...set.clips[idx], ...data }
    }
  }

  function deleteClip(setId: string, clipId: string) {
    const set = sets.value.find(s => s.id === setId)
    if (!set) return

    set.clips = set.clips.filter(c => c.id !== clipId)
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAYLIST CRUD
  // ═══════════════════════════════════════════════════════════════
  function addPlaylist(data: Omit<Playlist, 'id'>): Playlist {
    const playlist: Playlist = { id: generateId(), ...data }
    playlists.value.push(playlist)
    return playlist
  }

  function updatePlaylist(id: string, data: Partial<Playlist>) {
    const idx = playlists.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      playlists.value[idx] = { ...playlists.value[idx], ...data }
    }
  }

  function deletePlaylist(id: string) {
    playlists.value = playlists.value.filter(p => p.id !== id)
  }

  function getPlaylist(id: string): Playlist | null {
    return playlists.value.find(p => p.id === id) || null
  }

  // ═══════════════════════════════════════════════════════════════
  // DMX OUTPUT
  // ═══════════════════════════════════════════════════════════════
  const { sendDMX, isConnected: serialConnected } = useUnifiedSerial()

  // Apply master dimmer scaling to a dimmer value (9-134 range for pinspot)
  function applyDimmerScale(baseDimmer: number): number {
    const scale = masterDimmer.value / 100
    if (baseDimmer >= 9 && baseDimmer <= 134) {
      const intensity = (baseDimmer - 9) / 125
      return Math.round(9 + intensity * scale * 125)
    } else if (baseDimmer >= 240) {
      // Full mode: convert to scaled dimmer
      return Math.round(9 + scale * 125)
    }
    return baseDimmer
  }

  // Apply master dimmer to all device dimmers and send
  function sendDMXWithDimmer() {
    const dmx = [...currentDMXState.value]

    // Apply master dimmer to all devices' channel 0
    for (const device of devices.value) {
      const idx = device.startChannel - 1
      if (idx >= 0 && idx < dmx.length) {
        dmx[idx] = applyDimmerScale(currentDMXState.value[idx])
      }
    }

    sendDMX(dmx)
    return dmx
  }

  // Apply preset to selected device and send DMX (for testing mode)
  function applyPresetToDevice(presetId: string, deviceId: string) {
    applyPresetToDevices(presetId, [deviceId])
  }

  // Apply preset to multiple devices at once (for groups)
  function applyPresetToDevices(presetId: string, deviceIds: string[]) {
    const preset = getPreset(presetId)
    if (!preset) return

    const channels = presetToChannels(preset)

    for (const deviceId of deviceIds) {
      const device = getDevice(deviceId)
      if (!device) continue

      const start = device.startChannel - 1

      // For dimmer presets: only update channel 0 (dimmer), preserve current RGB state
      if (preset.category === 'dimmer') {
        currentDMXState.value[start] = channels[0]
      } else {
        // For normal presets: update all channels
        for (let i = 0; i < channels.length && start + i < 100; i++) {
          currentDMXState.value[start + i] = channels[i]
        }
      }
    }

    // Send with master dimmer applied (once for all devices)
    const sent = sendDMXWithDimmer()
    console.log('[DMX] Sent preset to', deviceIds.length, 'devices:', preset.name, 'master:', masterDimmer.value, '%', sent.slice(0, 16))
  }

  // Send blackout (all zeros)
  function sendBlackout() {
    currentDMXState.value = new Array(100).fill(0)
    sendDMX(currentDMXState.value)
    console.log('[DMX] Blackout sent')
  }

  // Refresh DMX output with current master dimmer (for testing mode when dimmer slider changes)
  function refreshDMXWithDimmer() {
    sendDMXWithDimmer()
    console.log('[DMX] Refreshed with master dimmer:', masterDimmer.value, '%')
  }

  // ═══════════════════════════════════════════════════════════════
  // DMX HELPERS
  // ═══════════════════════════════════════════════════════════════
  function getProfile(profileId: string): DeviceProfile | null {
    return getProfileById(profileId) || null
  }

  // Get profile for selected device
  const selectedDeviceProfile = computed(() => {
    if (!selectedDevice.value) return null
    return getProfile(selectedDevice.value.profileId)
  })

  // Get all devices for a target (resolves group to devices)
  function getTargetDevices(targetType: 'device' | 'group', targetId: string): Device[] {
    if (targetType === 'device') {
      const device = getDevice(targetId)
      return device ? [device] : []
    }
    return getGroupDevices(targetId)
  }

  // Get DMX array for active set at current beat (with additive mixing + auto-blackout)
  // Get active audio reactive settings for current beat (preset + device combos)
  interface ActiveAudioReactive {
    preset: Preset
    device: Device
    channelIdx: number  // Absolute DMX channel index (0-indexed)
  }

  function getActiveAudioReactiveSettings(set: Set, beat: number): ActiveAudioReactive[] {
    const result: ActiveAudioReactive[] = []
    const hasSolo = set.tracks.some(t => t.solo)

    for (const clip of set.clips) {
      if (beat < clip.startBeat || beat >= clip.startBeat + clip.duration) continue

      const track = set.tracks.find(t => t.id === clip.trackId)
      if (!track || track.muted) continue
      if (hasSolo && !track.solo) continue

      const preset = getPreset(clip.presetId)
      if (!preset?.audioReactive?.enabled) continue

      const targetDevices = getTargetDevices(track.targetType, track.targetId)
      for (const device of targetDevices) {
        result.push({
          preset,
          device,
          channelIdx: device.startChannel - 1 + preset.audioReactive.channel,
        })
      }
    }

    return result
  }

  function getSetDMX(set: Set, beat: number): number[] {
    // Start with all zeros (auto-blackout for inactive channels!)
    const dmx = new Array(512).fill(0)

    // Check if any track is soloed
    const hasSolo = set.tracks.some(t => t.solo)

    for (const clip of set.clips) {
      // Check if clip is active at current beat
      if (beat < clip.startBeat || beat >= clip.startBeat + clip.duration) continue

      const track = set.tracks.find(t => t.id === clip.trackId)
      if (!track || track.muted) continue

      // Handle solo: if any track soloed, skip non-soloed
      if (hasSolo && !track.solo) continue

      const preset = getPreset(clip.presetId)
      if (!preset) continue

      const targetDevices = getTargetDevices(track.targetType, track.targetId)

      // Apply preset to all devices (ADDITIVE merge - colors mix!)
      for (const device of targetDevices) {
        const channels = presetToChannels(preset)
        const start = device.startChannel - 1 // DMX is 1-indexed

        for (let i = 0; i < channels.length && start + i < 512; i++) {
          // Additive: add values, cap at 255
          dmx[start + i] = Math.min(255, dmx[start + i] + channels[i])
        }
      }
    }

    return dmx
  }

  // Channel spans a set actively CLAIMS at this beat (devices under an active,
  // audible clip). The FX-pad overlay uses this as its opacity mask: a clip
  // present = opaque (even painted black), no clip = base shows through.
  function getSetActiveSpans(set: Set, beat: number): { start: number; count: number }[] {
    const spans: { start: number; count: number }[] = []
    const hasSolo = set.tracks.some(t => t.solo)

    for (const clip of set.clips) {
      if (beat < clip.startBeat || beat >= clip.startBeat + clip.duration) continue

      const track = set.tracks.find(t => t.id === clip.trackId)
      if (!track || track.muted) continue
      if (hasSolo && !track.solo) continue
      if (!getPreset(clip.presetId)) continue

      for (const device of getTargetDevices(track.targetType, track.targetId)) {
        const profile = getProfile(device.profileId)
        spans.push({ start: device.startChannel - 1, count: profile?.channelCount ?? 5 })
      }
    }

    return spans
  }

  // Seed a starter rig (4 PinSpots positioned in 3D) + a demo set with a color
  // chase so the controller and 3D stage are immediately usable on first run.
  function seedDefaults() {
    const layout = [
      { ch: 1, x: -2.25 },
      { ch: 6, x: -0.75 },
      { ch: 11, x: 0.75 },
      { ch: 16, x: 2.25 },
    ]
    const ids = layout.map((l, i) => addDevice({
      name: `Pinspot ${i + 1}`,
      profileId: 'pinspot-rgbw-5ch',
      startChannel: l.ch,
      tags: ['pinspot'],
      position: { x: l.x, y: 2.6, z: -1.4 },
      rotation: { x: 55, y: 0, z: 0 },
    }).id)

    addGroup({ name: 'All Pinspots', profileId: 'pinspot-rgbw-5ch', deviceIds: [...ids], color: TRACK_COLORS[0]! })

    const set = addSet({ name: 'Demo', length: 8 })
    const colorBrushes = ['builtin-red', 'builtin-green', 'builtin-blue', 'builtin-white']
    // Beats are 1-indexed (grid columns 1..length).
    ids.forEach((id, i) => {
      const track = addTrackToSet(set.id, 'device', id)
      if (!track) return
      // single-color chase across beats 1-4 (one fixture per beat)
      addClipToSet(set.id, track.id, colorBrushes[i % colorBrushes.length]!, i + 1, 1)
      // all fixtures strobe together on the beats 5-8 drop
      addClipToSet(set.id, track.id, 'builtin-strobe-med', 5, 4)
    })

    selectSet(set.id)
    setActiveSet(set.id)
  }

  // Load the curated "VJ Pack": 6 hand-built sets (2 Intro, 2 Buildup, 2 Drop)
  // bound to the user's live pinspots. Idempotent: it (re)installs the pack
  // palette and refreshes the 6 named sets rather than duplicating them.
  function loadVjPack(): { ok: boolean; reason?: string; count: number } {
    // Map fixtures 1..6 to the user's RGBW pinspots in DMX-address order, so the
    // venue layout (1v4 / 2v5 / 3v6) lands on the right physical fixtures.
    const fixtureIds = devices.value
      .filter(d => getProfileById(d.profileId)?.controlType === 'rgbw')
      .slice()
      .sort((a, b) => a.startChannel - b.startChannel)
      .map(d => d.id)

    if (fixtureIds.length === 0) return { ok: false, reason: 'no-devices', count: 0 }

    // Install the pack palette (idempotent by stable id).
    for (const p of VJ_PRESETS) {
      if (!presets.value.some(x => x.id === p.id)) presets.value.push({ ...p })
    }

    // Refresh, not duplicate: drop any prior pack sets (current + legacy names).
    const packNames = new Set([...VJ_SET_NAMES, ...LEGACY_VJ_SET_NAMES])
    sets.value = sets.value.filter(s => !packNames.has(s.name))

    const built = buildVjSetPack(fixtureIds)
    let firstId: string | null = null
    for (const s of built) {
      const created = addSet(s)
      if (!firstId) firstId = created.id
    }

    if (firstId) {
      selectSet(firstId)
      setActiveSet(firstId)
    }
    saveToStorage()
    return { ok: true, count: built.length }
  }

  // Detect overlapping device control for UI warnings
  function getOverlappingDevices(set: Set, beat: number): Map<string, string[]> {
    const deviceTracks = new Map<string, string[]>() // deviceId -> trackNames[]

    for (const clip of set.clips) {
      if (beat < clip.startBeat || beat >= clip.startBeat + clip.duration) continue

      const track = set.tracks.find(t => t.id === clip.trackId)
      if (!track) continue

      const targetDevices = getTargetDevices(track.targetType, track.targetId)

      for (const device of targetDevices) {
        const existing = deviceTracks.get(device.id) || []
        existing.push(track.name)
        deviceTracks.set(device.id, existing)
      }
    }

    // Return only devices with multiple tracks
    return new Map([...deviceTracks].filter(([_, tracks]) => tracks.length > 1))
  }

  return {
    // State
    profiles,
    devices,
    groups,
    presets,
    scenes,
    sets,
    playlists,
    stage,
    selectedDeviceId,
    selectedGroupId,
    selectedPresetId,
    selectedSceneId,
    selectedSetId,
    activeSetId,

    // Palette state
    activeBrushId,
    activeBrush,
    recentPresets,
    toolMode,

    // Computed
    selectedDevice,
    selectedGroup,
    selectedPreset,
    selectedScene,
    selectedSet,
    activeSet,
    selectedDeviceProfile,
    presetsByProfile,
    presetsByCategory,

    // Device methods
    addDevice,
    updateDevice,
    updateDeviceTransform,
    deleteDevice,
    selectDevice,
    getDevice,

    // Stage / 3D
    setStage,

    // Group methods
    addGroup,
    updateGroup,
    deleteGroup,
    selectGroup,
    getGroup,
    getGroupDevices,

    // Preset methods
    addPreset,
    updatePreset,
    deletePreset,
    selectPreset,
    getPreset,
    getPresetsForProfile,

    // Combined preset selection (color + effect)
    selectedColorPresetId,
    selectedEffectPresetId,
    selectColorPreset,
    selectEffectPreset,
    getCombinedPresetValues,

    // Palette methods
    setActiveBrush,
    setToolMode,
    toggleToolMode,

    // Scene methods
    addScene,
    updateScene,
    deleteScene,
    selectScene,
    getScene,
    saveSetAsScene,
    loadSceneToSet,

    // Set methods
    addSet,
    updateSet,
    deleteSet,
    selectSet,
    setActiveSet,
    loadVjPack,

    // Track methods
    addTrackToSet,
    updateTrack,
    deleteTrack,

    // Clip methods
    addClipToSet,
    updateClip,
    deleteClip,

    // Playlist methods
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    getPlaylist,

    // DMX helpers
    getProfile,
    getTargetDevices,
    getSetDMX,
    getSetActiveSpans,
    getActiveAudioReactiveSettings,
    getOverlappingDevices,

    // DMX output
    serialConnected,
    applyPresetToDevice,
    applyPresetToDevices,
    sendBlackout,
    sendDMX,
    refreshDMXWithDimmer,

    // Storage
    loadFromStorage,
    saveToStorage,
  }
}
