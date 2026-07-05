// MIDI Mapper - maps MIDI inputs to InputActions.
// Execution is delegated to the shared, source-agnostic dispatcher
// (useInputActions.dispatchAction) - the SAME executor the gamepad uses.

import { ref, watch } from 'vue'
import { useMIDI } from './useMIDI'
import { useInputActions } from './useInputActions'
import type { InputAction, InputActionType } from './useInputActions'

// Back-compat aliases (the config modal imports these names)
export type MIDIActionType = InputActionType
export type MIDIAction = InputAction

export interface MIDIMapping {
  id: string
  name: string
  midiType: 'cc' | 'note'
  midiNumber: number
  channel: number
  action: MIDIAction
}

const STORAGE_KEY = 'midi-mappings'

// Default mappings for a QMK MIDI keyboard (channel 1)
const DEFAULT_MAPPINGS: MIDIMapping[] = [
  { id: 'default-dimmer', name: 'Master Dimmer', midiType: 'cc', midiNumber: 74, channel: 1, action: { type: 'master:dimmer' } },
  { id: 'default-play', name: 'Play/Pause', midiType: 'note', midiNumber: 48, channel: 1, action: { type: 'transport:play' } },
  { id: 'default-blackout', name: 'Blackout', midiType: 'note', midiNumber: 49, channel: 1, action: { type: 'master:blackout' } },
  { id: 'default-activate', name: 'Activate Set', midiType: 'note', midiNumber: 54, channel: 1, action: { type: 'set:activate' } },
  { id: 'default-prev', name: 'Prev Set', midiType: 'note', midiNumber: 55, channel: 1, action: { type: 'set:prev' } },
  { id: 'default-next', name: 'Next Set', midiType: 'note', midiNumber: 56, channel: 1, action: { type: 'set:next' } },
  { id: 'default-tap', name: 'Tap Tempo', midiType: 'note', midiNumber: 66, channel: 1, action: { type: 'transport:tap' } },
]

const mappings = ref<MIDIMapping[]>([])
const isLearning = ref(false)
const learningCallback = ref<((event: { type: 'cc' | 'note', number: number, channel: number }) => void) | null>(null)
const lastTriggeredMappingId = ref<string | null>(null)
const lastTriggeredValue = ref<number>(0)
let watcherInitialized = false

function isValidMapping(m: any): m is MIDIMapping {
  return m &&
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    (m.midiType === 'cc' || m.midiType === 'note') &&
    typeof m.midiNumber === 'number' &&
    typeof m.channel === 'number' &&
    m.action && typeof m.action.type === 'string'
}

function loadMappings() {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const valid = Array.isArray(parsed) ? parsed.filter(isValidMapping) : []
      mappings.value = valid.length > 0 ? valid : [...DEFAULT_MAPPINGS]
      if (valid.length === 0) saveMappings()
    } else {
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings.value)) } catch (e) {
    console.warn('[MIDIMapper] Failed to save mappings:', e)
  }
}

loadMappings()

export function useMIDIMapper() {
  const midi = useMIDI()
  const { dispatchAction } = useInputActions()

  if (!watcherInitialized) {
    watcherInitialized = true

    watch(() => midi.lastEvent.value, (event) => {
      if (!event) return

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
        return
      }

      const mapping = findMapping(event)
      if (!mapping) return

      const raw = event.value ?? event.velocity ?? 127
      lastTriggeredMappingId.value = mapping.id
      lastTriggeredValue.value = raw

      // Normalize 0-127 -> 0..1 for the shared dispatcher
      dispatchAction(mapping.action, raw / 127)

      if (mapping.midiType === 'note') {
        setTimeout(() => {
          if (lastTriggeredMappingId.value === mapping.id) lastTriggeredMappingId.value = null
        }, 200)
      }
    })
  }

  function findMapping(event: typeof midi.lastEvent.value): MIDIMapping | null {
    if (!event) return null
    return mappings.value.find(m => {
      if (m.midiType === 'cc' && event.type !== 'cc') return false
      if (m.midiType === 'note' && event.type !== 'noteon') return false
      const eventNumber = event.type === 'cc' ? event.cc : event.note
      if (m.midiNumber !== eventNumber) return false
      if (m.channel !== event.channel) return false
      return true
    }) || null
  }

  function addMapping(mapping: Omit<MIDIMapping, 'id'>) {
    const newMapping: MIDIMapping = { ...mapping, id: `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
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

  function startLearning(callback: (event: { type: 'cc' | 'note', number: number, channel: number }) => void) {
    isLearning.value = true
    learningCallback.value = callback
  }

  function cancelLearning() {
    isLearning.value = false
    learningCallback.value = null
  }

  // Back-compat: callers passing raw 0-127
  function executeAction(action: MIDIAction, value: number) {
    dispatchAction(action, value / 127)
  }

  return {
    mappings,
    isLearning,
    lastTriggeredMappingId,
    lastTriggeredValue,
    connected: midi.isConnected,
    addMapping,
    updateMapping,
    deleteMapping,
    loadDefaults,
    clearAll,
    startLearning,
    cancelLearning,
    executeAction,
  }
}
