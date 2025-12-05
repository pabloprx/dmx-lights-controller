// MIDI Mapper - Maps MIDI inputs to DMX actions
// Handles CC, Note events and executes configured actions

import { ref, watch } from 'vue'
import { useMIDI } from './useMIDI'
import { useSetPlayer } from './useSetPlayer'
import { useAppMode } from './useAppMode'
import { useDMXStore } from './useDMXStore'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type MIDIActionType =
  | 'master:dimmer'
  | 'master:blackout'
  | 'transport:play'
  | 'transport:stop'
  | 'set:next'
  | 'set:prev'
  | 'set:activate'  // Just activate, don't auto-play
  | 'set:trigger'   // Activate AND start playing

export interface MIDIAction {
  type: MIDIActionType
  setId?: string  // For set:trigger
}

export interface MIDIMapping {
  id: string
  name: string
  midiType: 'cc' | 'note'
  midiNumber: number
  channel: number
  action: MIDIAction
}

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'midi-mappings'

// Default mappings based on QMK keyboard layout
// Note 72 = C5 (Play/Pause), 73 = C#5 (Blackout), 74 = CC (Dimmer)
// Note 79 = G5 (Prev), 80 = G#5 (Next), 83 = B5 (Set Active)
const DEFAULT_MAPPINGS: MIDIMapping[] = [
  { id: 'default-dimmer', name: 'Master Dimmer', midiType: 'cc', midiNumber: 74, channel: 1, action: { type: 'master:dimmer' } },
  { id: 'default-play', name: 'Play/Pause', midiType: 'note', midiNumber: 72, channel: 1, action: { type: 'transport:play' } },
  { id: 'default-blackout', name: 'Blackout', midiType: 'note', midiNumber: 73, channel: 1, action: { type: 'master:blackout' } },
  { id: 'default-prev', name: 'Prev Set', midiType: 'note', midiNumber: 79, channel: 1, action: { type: 'set:prev' } },
  { id: 'default-next', name: 'Next Set', midiType: 'note', midiNumber: 80, channel: 1, action: { type: 'set:next' } },
  { id: 'default-setactive', name: 'Set Active', midiType: 'note', midiNumber: 83, channel: 1, action: { type: 'set:activate' } },
]

// ═══════════════════════════════════════════════════════════════
// STATE (singleton)
// ═══════════════════════════════════════════════════════════════

const mappings = ref<MIDIMapping[]>([])
const isLearning = ref(false)
const learningCallback = ref<((event: { type: 'cc' | 'note', number: number, channel: number }) => void) | null>(null)
const lastTriggeredMappingId = ref<string | null>(null)
const lastTriggeredValue = ref<number>(0)
let watcherInitialized = false

// Smooth dimmer interpolation
let dimmerTarget = 100
let dimmerCurrent = 100
let dimmerAnimationFrame: number | null = null
const DIMMER_SMOOTHING = 0.12 // Lower = smoother/slower (0-1)

// Validate a mapping has all required fields
function isValidMapping(m: any): m is MIDIMapping {
  return m &&
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    (m.midiType === 'cc' || m.midiType === 'note') &&
    typeof m.midiNumber === 'number' &&
    typeof m.channel === 'number' &&
    m.action && typeof m.action.type === 'string'
}

// Smooth dimmer animation using requestAnimationFrame
function smoothDimmer(player: ReturnType<typeof useSetPlayer>) {
  if (dimmerAnimationFrame) {
    cancelAnimationFrame(dimmerAnimationFrame)
  }

  function animate() {
    const diff = dimmerTarget - dimmerCurrent
    if (Math.abs(diff) < 0.5) {
      // Close enough, snap to target
      dimmerCurrent = dimmerTarget
      player.setMasterDimmer(Math.round(dimmerCurrent))
      dimmerAnimationFrame = null
      return
    }

    // Lerp towards target
    dimmerCurrent += diff * DIMMER_SMOOTHING
    player.setMasterDimmer(Math.round(dimmerCurrent))
    dimmerAnimationFrame = requestAnimationFrame(animate)
  }

  dimmerAnimationFrame = requestAnimationFrame(animate)
}

// Load from storage on init
function loadMappings() {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Filter out invalid mappings
      const valid = Array.isArray(parsed) ? parsed.filter(isValidMapping) : []
      if (valid.length > 0) {
        mappings.value = valid
      } else {
        // All invalid or empty: use defaults
        mappings.value = [...DEFAULT_MAPPINGS]
        saveMappings()
      }
    } else {
      // First time: use defaults
      mappings.value = [...DEFAULT_MAPPINGS]
      saveMappings()
    }
  } catch (e) {
    console.warn('[MIDIMapper] Failed to load mappings:', e)
    mappings.value = [...DEFAULT_MAPPINGS]
  }
}

function saveMappings() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings.value))
  } catch (e) {
    console.warn('[MIDIMapper] Failed to save mappings:', e)
  }
}

// Initialize
loadMappings()

// ═══════════════════════════════════════════════════════════════
// COMPOSABLE
// ═══════════════════════════════════════════════════════════════

export function useMIDIMapper() {
  const midi = useMIDI()
  const player = useSetPlayer()
  const appMode = useAppMode()
  const store = useDMXStore()

  // Watch for MIDI events and process them (only initialize once)
  if (!watcherInitialized) {
    watcherInitialized = true
    console.log('[MIDIMapper] Setting up MIDI event watcher')

    watch(() => midi.lastEvent.value, (event) => {
      if (!event) return

      console.log('[MIDIMapper] Event received:', event.type, 'note:', event.note, 'cc:', event.cc, 'vel:', event.velocity, 'val:', event.value, 'ch:', event.channel)

      // Handle learning mode
      if (isLearning.value && learningCallback.value) {
        if (event.type === 'cc' || event.type === 'noteon') {
          learningCallback.value({
            type: event.type === 'cc' ? 'cc' : 'note',
            number: event.type === 'cc' ? event.cc! : event.note!,
            channel: event.channel,
          })
          isLearning.value = false
          learningCallback.value = null
        }
        return // Don't process mapping while learning
      }

      // Find matching mapping
      const mapping = findMapping(event)
      console.log('[MIDIMapper] Mapping found:', mapping?.name || 'none')

      if (mapping) {
        const value = event.value ?? event.velocity ?? 127
        lastTriggeredMappingId.value = mapping.id
        lastTriggeredValue.value = value
        executeAction(mapping.action, value)

        // Clear triggered indicator after a short delay (for notes)
        if (mapping.midiType === 'note') {
          setTimeout(() => {
            if (lastTriggeredMappingId.value === mapping.id) {
              lastTriggeredMappingId.value = null
            }
          }, 200)
        }
      }
    })
  }

  // Find mapping for event
  function findMapping(event: typeof midi.lastEvent.value): MIDIMapping | null {
    if (!event) return null

    return mappings.value.find(m => {
      // Match type - for notes, only match noteon (key press), ignore noteoff (key release)
      if (m.midiType === 'cc' && event.type !== 'cc') return false
      if (m.midiType === 'note' && event.type !== 'noteon') return false

      // Match number
      const eventNumber = event.type === 'cc' ? event.cc : event.note
      if (m.midiNumber !== eventNumber) return false

      // Match channel
      if (m.channel !== event.channel) return false

      return true
    }) || null
  }

  // Execute action
  function executeAction(action: MIDIAction, value: number) {
    console.log('[MIDIMapper] Execute:', action.type, 'value:', value)

    switch (action.type) {
      case 'master:dimmer':
        // Map 0-127 to 0-100 with smooth interpolation
        dimmerTarget = Math.round((value / 127) * 100)
        smoothDimmer(player)
        break

      case 'master:blackout':
        // Only trigger on note-on (value > 0)
        if (value > 0) {
          appMode.toggleBlackout()
        }
        break

      case 'transport:play':
        if (value > 0) {
          // Unified playback - handles both player and internal tempo
          if (player.isPlaying.value) {
            player.stop()
            // Also stop internal tempo in testing mode
            if (appMode.isTestingMode.value && appMode.internalPlaying.value) {
              appMode.toggleInternalPlayback()
            }
          } else {
            player.play()
            // Also start internal tempo in testing mode
            if (appMode.isTestingMode.value && !appMode.internalPlaying.value) {
              appMode.toggleInternalPlayback()
            }
          }
        }
        break

      case 'transport:stop':
        if (value > 0) {
          player.stop()
          // Also stop internal tempo
          if (appMode.internalPlaying.value) {
            appMode.stopInternalPlayback()
          }
        }
        break

      case 'set:next':
        if (value > 0) {
          nextSet()
        }
        break

      case 'set:prev':
        if (value > 0) {
          prevSet()
        }
        break

      case 'set:activate':
        // Activate the selected/viewed set (same as "Set Active" button)
        if (value > 0) {
          const setId = action.setId || store.selectedSet.value?.id
          if (setId) {
            player.setActiveSet(setId)
          }
        }
        break

      case 'set:trigger':
        // Activate AND start playing (selected set or specific setId)
        if (value > 0) {
          const setId = action.setId || store.selectedSet.value?.id
          if (setId) {
            player.setActiveSet(setId)
            player.play()
            // Also start internal tempo in testing mode
            if (appMode.isTestingMode.value && !appMode.internalPlaying.value) {
              appMode.toggleInternalPlayback()
            }
          }
        }
        break
    }
  }

  // Navigate sets - changes the selected/viewed set in the SetEditor dropdown
  function nextSet() {
    const allSets = store.sets.value
    if (allSets.length === 0) return

    const currentId = store.selectedSet.value?.id
    const currentIndex = currentId ? allSets.findIndex(s => s.id === currentId) : -1
    const nextIndex = (currentIndex + 1) % allSets.length
    store.selectSet(allSets[nextIndex].id)
  }

  function prevSet() {
    const allSets = store.sets.value
    if (allSets.length === 0) return

    const currentId = store.selectedSet.value?.id
    const currentIndex = currentId ? allSets.findIndex(s => s.id === currentId) : 0
    const prevIndex = currentIndex <= 0 ? allSets.length - 1 : currentIndex - 1
    store.selectSet(allSets[prevIndex].id)
  }

  // Mapping CRUD
  function addMapping(mapping: Omit<MIDIMapping, 'id'>) {
    const newMapping: MIDIMapping = {
      ...mapping,
      id: `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    mappings.value.push(newMapping)
    saveMappings()
    return newMapping
  }

  function updateMapping(id: string, updates: Partial<Omit<MIDIMapping, 'id'>>) {
    const index = mappings.value.findIndex(m => m.id === id)
    if (index >= 0) {
      mappings.value[index] = { ...mappings.value[index], ...updates }
      saveMappings()
    }
  }

  function deleteMapping(id: string) {
    mappings.value = mappings.value.filter(m => m.id !== id)
    saveMappings()
  }

  function loadDefaults() {
    mappings.value = [...DEFAULT_MAPPINGS]
    saveMappings()
  }

  function clearAll() {
    mappings.value = []
    saveMappings()
  }

  // Learning mode
  function startLearning(callback: (event: { type: 'cc' | 'note', number: number, channel: number }) => void) {
    isLearning.value = true
    learningCallback.value = callback
  }

  function cancelLearning() {
    isLearning.value = false
    learningCallback.value = null
  }

  return {
    // State
    mappings,
    isLearning,
    lastTriggeredMappingId,
    lastTriggeredValue,

    // CRUD
    addMapping,
    updateMapping,
    deleteMapping,
    loadDefaults,
    clearAll,

    // Learning
    startLearning,
    cancelLearning,

    // Utils
    executeAction,
  }
}
