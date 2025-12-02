import { ref, computed, watch } from 'vue'
import type { Fixture, FixtureProfile, Preset, Scene, Bank, FixtureValues } from '~/types/dmx'
import { PINSPOT_RGBW, generateId, createDefaultValues, createDefaultBank, valuesToDMX } from '~/types/dmx'

const STORAGE_KEY = 'dmx-store-v2'

// Shared state (singleton)
const profiles = ref<FixtureProfile[]>([PINSPOT_RGBW])
const fixtures = ref<Fixture[]>([])
const presets = ref<Preset[]>([])
const scenes = ref<Scene[]>([])
const banks = ref<Bank[]>([])

// Selection state
const selectedFixtureId = ref<string | null>(null)
const selectedPresetId = ref<string | null>(null)
const selectedSceneId = ref<string | null>(null)
const selectedBankId = ref<string | null>(null)
const activeBankId = ref<string | null>(null) // Bank currently playing

// Load from localStorage
function loadFromStorage() {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      fixtures.value = data.fixtures || []
      presets.value = data.presets || []
      scenes.value = data.scenes || []
      banks.value = data.banks || []
      activeBankId.value = data.activeBankId || null
    }
  } catch (e) {
    console.error('[DMXStore] Failed to load from storage:', e)
  }
}

// Save to localStorage
function saveToStorage() {
  if (typeof window === 'undefined') return

  try {
    const data = {
      fixtures: fixtures.value,
      presets: presets.value,
      scenes: scenes.value,
      banks: banks.value,
      activeBankId: activeBankId.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('[DMXStore] Failed to save to storage:', e)
  }
}

export function useDMXStore() {
  // Initialize on first use
  if (fixtures.value.length === 0 && presets.value.length === 0 && typeof window !== 'undefined') {
    loadFromStorage()
  }

  // Auto-save on changes
  watch([fixtures, presets, scenes, banks, activeBankId], saveToStorage, { deep: true })

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════

  const selectedFixture = computed(() =>
    fixtures.value.find(f => f.id === selectedFixtureId.value) || null
  )

  const selectedPreset = computed(() =>
    presets.value.find(p => p.id === selectedPresetId.value) || null
  )

  const selectedScene = computed(() =>
    scenes.value.find(s => s.id === selectedSceneId.value) || null
  )

  const selectedBank = computed(() =>
    banks.value.find(b => b.id === selectedBankId.value) || null
  )

  const activeBank = computed(() =>
    banks.value.find(b => b.id === activeBankId.value) || null
  )

  // Get presets grouped by fixture
  const presetsByFixture = computed(() => {
    const grouped = new Map<string, Preset[]>()
    for (const fixture of fixtures.value) {
      grouped.set(fixture.id, presets.value.filter(p => p.fixtureId === fixture.id))
    }
    return grouped
  })

  // ═══════════════════════════════════════════════════════════════
  // FIXTURE CRUD
  // ═══════════════════════════════════════════════════════════════

  function addFixture(data: Omit<Fixture, 'id'>): Fixture {
    const fixture: Fixture = { id: generateId(), ...data }
    fixtures.value.push(fixture)
    return fixture
  }

  function updateFixture(id: string, data: Partial<Fixture>) {
    const idx = fixtures.value.findIndex(f => f.id === id)
    if (idx !== -1) {
      fixtures.value[idx] = { ...fixtures.value[idx], ...data }
    }
  }

  function deleteFixture(id: string) {
    // Delete fixture
    fixtures.value = fixtures.value.filter(f => f.id !== id)
    // Delete all presets for this fixture
    const deletedPresetIds = presets.value.filter(p => p.fixtureId === id).map(p => p.id)
    presets.value = presets.value.filter(p => p.fixtureId !== id)
    // Remove deleted presets from scenes
    for (const scene of scenes.value) {
      scene.presetIds = scene.presetIds.filter(pid => !deletedPresetIds.includes(pid))
    }
    // Clear selection
    if (selectedFixtureId.value === id) selectedFixtureId.value = null
  }

  function selectFixture(id: string | null) {
    selectedFixtureId.value = id
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
    const idx = presets.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      presets.value[idx] = { ...presets.value[idx], ...data }
    }
  }

  function deletePreset(id: string) {
    presets.value = presets.value.filter(p => p.id !== id)
    // Remove from all scenes
    for (const scene of scenes.value) {
      scene.presetIds = scene.presetIds.filter(pid => pid !== id)
    }
    if (selectedPresetId.value === id) selectedPresetId.value = null
  }

  function selectPreset(id: string | null) {
    selectedPresetId.value = id
  }

  function getPresetsForFixture(fixtureId: string): Preset[] {
    return presets.value.filter(p => p.fixtureId === fixtureId)
  }

  function getPreset(id: string): Preset | null {
    return presets.value.find(p => p.id === id) || null
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
    // Remove from all banks
    for (const bank of banks.value) {
      bank.cells = bank.cells.map(cell => cell === id ? null : cell)
    }
    if (selectedSceneId.value === id) selectedSceneId.value = null
  }

  function selectScene(id: string | null) {
    selectedSceneId.value = id
  }

  function getScene(id: string): Scene | null {
    return scenes.value.find(s => s.id === id) || null
  }

  // ═══════════════════════════════════════════════════════════════
  // BANK CRUD
  // ═══════════════════════════════════════════════════════════════

  function addBank(data?: Partial<Omit<Bank, 'id'>>): Bank {
    const defaults = createDefaultBank()
    const bank: Bank = {
      id: generateId(),
      name: data?.name || defaults.name,
      length: data?.length || defaults.length,
      unitDuration: data?.unitDuration || defaults.unitDuration,
      cells: data?.cells || defaults.cells,
    }
    banks.value.push(bank)
    return bank
  }

  function updateBank(id: string, data: Partial<Bank>) {
    const idx = banks.value.findIndex(b => b.id === id)
    if (idx !== -1) {
      const bank = banks.value[idx]
      // If length changed, adjust cells array
      if (data.length && data.length !== bank.length) {
        const newLength = Math.round(data.length / (data.unitDuration || bank.unitDuration))
        const oldCells = bank.cells
        data.cells = Array(newLength).fill(null).map((_, i) => oldCells[i] || null)
      }
      banks.value[idx] = { ...bank, ...data }
    }
  }

  function deleteBank(id: string) {
    banks.value = banks.value.filter(b => b.id !== id)
    if (selectedBankId.value === id) selectedBankId.value = null
    if (activeBankId.value === id) activeBankId.value = null
  }

  function selectBank(id: string | null) {
    selectedBankId.value = id
  }

  function setActiveBank(id: string | null) {
    activeBankId.value = id
  }

  function setBankCell(bankId: string, cellIndex: number, sceneId: string | null) {
    const bank = banks.value.find(b => b.id === bankId)
    if (bank && cellIndex >= 0 && cellIndex < bank.cells.length) {
      bank.cells[cellIndex] = sceneId
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DMX HELPERS
  // ═══════════════════════════════════════════════════════════════

  function getProfile(profileId: string): FixtureProfile | null {
    return profiles.value.find(p => p.id === profileId) || null
  }

  // Get DMX values for a single fixture given its values
  function getFixtureDMX(fixtureId: string, values: FixtureValues): { startChannel: number; channels: number[] } | null {
    const fixture = fixtures.value.find(f => f.id === fixtureId)
    if (!fixture) return null
    return {
      startChannel: fixture.startChannel,
      channels: valuesToDMX(values),
    }
  }

  // Get full 512-channel DMX array for a scene
  function getSceneDMX(sceneId: string): number[] {
    const dmx = new Array(512).fill(0)
    const scene = scenes.value.find(s => s.id === sceneId)
    if (!scene) return dmx

    for (const presetId of scene.presetIds) {
      const preset = presets.value.find(p => p.id === presetId)
      if (!preset) continue

      const fixture = fixtures.value.find(f => f.id === preset.fixtureId)
      if (!fixture) continue

      const channels = valuesToDMX(preset.values)
      const startIdx = fixture.startChannel - 1 // DMX is 1-indexed

      for (let i = 0; i < channels.length; i++) {
        if (startIdx + i < 512) {
          dmx[startIdx + i] = channels[i]
        }
      }
    }

    return dmx
  }

  // Get the scene at a specific beat position in the active bank
  function getSceneAtBeat(beat: number): Scene | null {
    const bank = activeBank.value
    if (!bank) return null

    const cellCount = bank.cells.length
    const beatsPerCell = bank.unitDuration
    const totalBeats = bank.length

    // Normalize beat to bank loop
    const beatInLoop = beat % totalBeats
    const cellIndex = Math.floor(beatInLoop / beatsPerCell)

    if (cellIndex >= 0 && cellIndex < cellCount) {
      const sceneId = bank.cells[cellIndex]
      if (sceneId) {
        return scenes.value.find(s => s.id === sceneId) || null
      }
    }

    return null
  }

  return {
    // State
    profiles,
    fixtures,
    presets,
    scenes,
    banks,
    selectedFixtureId,
    selectedPresetId,
    selectedSceneId,
    selectedBankId,
    activeBankId,

    // Computed
    selectedFixture,
    selectedPreset,
    selectedScene,
    selectedBank,
    activeBank,
    presetsByFixture,

    // Fixture methods
    addFixture,
    updateFixture,
    deleteFixture,
    selectFixture,

    // Preset methods
    addPreset,
    updatePreset,
    deletePreset,
    selectPreset,
    getPresetsForFixture,
    getPreset,

    // Scene methods
    addScene,
    updateScene,
    deleteScene,
    selectScene,
    getScene,

    // Bank methods
    addBank,
    updateBank,
    deleteBank,
    selectBank,
    setActiveBank,
    setBankCell,

    // DMX helpers
    getProfile,
    getFixtureDMX,
    getSceneDMX,
    getSceneAtBeat,

    // Storage
    loadFromStorage,
    saveToStorage,
  }
}
