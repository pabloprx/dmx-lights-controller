import { ref, computed, watch } from 'vue'
import type {
  DeviceProfile, Device, Group, Preset, Scene, SceneTrack, SceneClip,
  Set, SetTrack, SetClip, Playlist, PresetValues, SetLength
} from '~/types/dmx'
import {
  DEVICE_PROFILES, BUILT_IN_PRESETS, TRACK_COLORS,
  generateId, createDefaultSet, createDefaultTrack, valuesToDMX, getProfileById
} from '~/types/dmx'

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

// Selection state
const selectedDeviceId = ref<string | null>(null)
const selectedGroupId = ref<string | null>(null)
const selectedPresetId = ref<string | null>(null)
const selectedSceneId = ref<string | null>(null)
const selectedSetId = ref<string | null>(null)
const activeSetId = ref<string | null>(null) // Set currently playing

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════
function loadFromStorage() {
  if (typeof window === 'undefined') return

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
      sets.value = data.sets || []
      playlists.value = data.playlists || []
      activeSetId.value = data.activeSetId || null
    }
  } catch (e) {
    console.error('[DMXStore] Failed to load from storage:', e)
  }
}

function saveToStorage() {
  if (typeof window === 'undefined') return

  try {
    const data = {
      devices: devices.value,
      groups: groups.value,
      presets: presets.value.filter(p => !p.isBuiltIn), // Only save user presets
      scenes: scenes.value,
      sets: sets.value,
      playlists: playlists.value,
      activeSetId: activeSetId.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[DMXStore] Failed to save to storage:', e)
  }
}

export function useDMXStore() {
  // Initialize on first use
  if (devices.value.length === 0 && sets.value.length === 0 && typeof window !== 'undefined') {
    loadFromStorage()
  }

  // Auto-save on changes
  watch([devices, groups, presets, scenes, sets, playlists, activeSetId], saveToStorage, { deep: true })

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
  function addDevice(data: Omit<Device, 'id'>): Device {
    const device: Device = { id: generateId(), ...data }
    devices.value.push(device)
    return device
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

  function getPresetsForProfile(profileId: string): Preset[] {
    return presets.value.filter(p => p.profileId === profileId)
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

    // Replace set tracks and clips
    set.tracks = newTracks
    set.clips = newClips
    set.length = scene.length

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
        const channels = valuesToDMX(preset.values)
        const start = device.startChannel - 1 // DMX is 1-indexed

        for (let i = 0; i < channels.length && start + i < 512; i++) {
          // Additive: add values, cap at 255
          dmx[start + i] = Math.min(255, dmx[start + i] + channels[i])
        }
      }
    }

    return dmx
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
    selectedDeviceId,
    selectedGroupId,
    selectedPresetId,
    selectedSceneId,
    selectedSetId,
    activeSetId,

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
    deleteDevice,
    selectDevice,
    getDevice,

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
    getOverlappingDevices,

    // Storage
    loadFromStorage,
    saveToStorage,
  }
}
