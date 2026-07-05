// ═══════════════════════════════════════════════════════════════
// GAMEPAD MAPPER - maps Xbox controller controls to InputActions.
// Shares the SAME executor as MIDI (useInputActions.dispatchAction).
// ═══════════════════════════════════════════════════════════════

import { ref } from 'vue'
import { useGamepad } from './useGamepad'
import { useInputActions } from './useInputActions'
import type { InputAction } from './useInputActions'
import { ACTION_CATALOG } from './useInputActions'

export interface GamepadMapping {
  id: string
  name: string
  control: 'button' | 'axis'
  index: number
  action: InputAction
}

const STORAGE_KEY = 'gamepad-mappings-v6'

// Default Xbox live-play layout. Standard-mapping button/axis indices.
// Live core (right hand): A = play/pause, X = activate selected set (output),
// B = beat-sync, Y = blackout (toggle). Left hand: RT = master dimmer (rest 100%),
// LT held = strobe, RB held = blinder, LB held = blackout.
// D-pad is 2D set browsing: Up/Down = SECTION (Intro/Buildup/Drop/FX...),
// Left/Right = prev/next SET within that section.
// Sticks: L-X = L/R bar balance, R-stick = live color wash.
// Tap tempo on View AND Share (Share sits center, easy to tap on the beat).
const DEFAULT_MAPPINGS: GamepadMapping[] = [
  { id: 'gp-a', name: 'A - Play/Pause', control: 'button', index: 0, action: { type: 'transport:play' } },
  { id: 'gp-x', name: 'X - Activate Set', control: 'button', index: 2, action: { type: 'set:activate' } },
  { id: 'gp-b', name: 'B - Beat Sync', control: 'button', index: 1, action: { type: 'transport:beat-sync' } },
  { id: 'gp-y', name: 'Y - Blackout', control: 'button', index: 3, action: { type: 'master:blackout' } },
  { id: 'gp-lb', name: 'LB - Blackout (hold)', control: 'button', index: 4, action: { type: 'override:blackout-hold' } },
  { id: 'gp-rb', name: 'RB - Blinder (hold)', control: 'button', index: 5, action: { type: 'override:blinder-hold' } },
  { id: 'gp-lt', name: 'LT - Strobe (hold)', control: 'button', index: 6, action: { type: 'master:strobe-momentary' } },
  { id: 'gp-rt', name: 'RT - Master Dimmer (rest = 100%)', control: 'button', index: 7, action: { type: 'master:dimmer', invert: true } },
  { id: 'gp-dup', name: 'D-Up - Prev Section', control: 'button', index: 12, action: { type: 'set:section-prev' } },
  { id: 'gp-ddown', name: 'D-Down - Next Section', control: 'button', index: 13, action: { type: 'set:section-next' } },
  { id: 'gp-dleft', name: 'D-Left - Prev Set', control: 'button', index: 14, action: { type: 'set:prev' } },
  { id: 'gp-dright', name: 'D-Right - Next Set', control: 'button', index: 15, action: { type: 'set:next' } },
  { id: 'gp-view', name: 'View - Tap Tempo', control: 'button', index: 8, action: { type: 'transport:tap' } },
  { id: 'gp-menu', name: 'Menu - Trigger Set', control: 'button', index: 9, action: { type: 'set:trigger' } },
  { id: 'gp-l3', name: 'L3 - Reverse (hold)', control: 'button', index: 10, action: { type: 'playback:reverse-hold' } },
  { id: 'gp-r3', name: 'R3 - Reset Dimmer', control: 'button', index: 11, action: { type: 'master:dimmer-reset' } },
  { id: 'gp-share', name: 'Share - Tap Tempo', control: 'button', index: 17, action: { type: 'transport:tap' } },
  // Analog sticks: L-stick X pans Left/Right bars; R-stick washes a live color.
  { id: 'gp-lx', name: 'L-Stick X - L/R Balance', control: 'axis', index: 0, action: { type: 'fx:lr-balance' } },
  { id: 'gp-rx', name: 'R-Stick X - Color Hue', control: 'axis', index: 2, action: { type: 'fx:color-tint-hue' } },
  { id: 'gp-ry', name: 'R-Stick Y - Color Amount', control: 'axis', index: 3, action: { type: 'fx:color-tint-amount' } },
]

const mappings = ref<GamepadMapping[]>([])
const isLearning = ref(false)
const learningCallback = ref<((e: { control: 'button' | 'axis', index: number }) => void) | null>(null)
const lastTriggeredMappingId = ref<string | null>(null)
let watcherInitialized = false

function isValid(m: any): m is GamepadMapping {
  return m && typeof m.id === 'string' && (m.control === 'button' || m.control === 'axis') &&
    typeof m.index === 'number' && m.action && typeof m.action.type === 'string'
}

function load() {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const valid = Array.isArray(parsed) ? parsed.filter(isValid) : []
      mappings.value = valid.length > 0 ? valid : [...DEFAULT_MAPPINGS]
    } else {
      mappings.value = [...DEFAULT_MAPPINGS]
      save()
    }
  } catch {
    mappings.value = [...DEFAULT_MAPPINGS]
  }
}

function save() {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings.value)) } catch {}
}

load()

function isAnalogAction(type: string): boolean {
  return ACTION_CATALOG.find(a => a.type === type)?.analog ?? false
}

export function useGamepadMapper() {
  const gamepad = useGamepad()
  const { dispatchAction } = useInputActions()

  if (!watcherInitialized) {
    watcherInitialized = true
    gamepad.start()

    // Subscribe synchronously so NO event is dropped when several fire in one
    // poll frame (e.g. release one button + press another simultaneously).
    gamepad.onEvent((event) => {
      if (!event) return

      if (isLearning.value && learningCallback.value) {
        // Only learn deliberate input (button press or strong axis push)
        if ((event.kind === 'button' && event.pressed) || (event.kind === 'axis' && Math.abs(event.value) > 0.5)) {
          learningCallback.value({ control: event.kind, index: event.index })
          isLearning.value = false
          learningCallback.value = null
        }
        return
      }

      const mapping = mappings.value.find(m => m.control === event.kind && m.index === event.index)
      if (!mapping) return

      // Normalize to 0..1 for the dispatcher.
      let value01: number
      if (event.kind === 'axis') {
        value01 = isAnalogAction(mapping.action.type) ? (event.value + 1) / 2 : (event.pressed ? 1 : 0)
      } else {
        value01 = event.value // buttons already 0..1
      }

      lastTriggeredMappingId.value = mapping.id
      dispatchAction(mapping.action, value01)
      if (event.kind === 'button' && !event.pressed && mapping.action.type !== 'master:strobe-momentary') {
        // brief flash indicator clears on release
        if (lastTriggeredMappingId.value === mapping.id) lastTriggeredMappingId.value = null
      }
    })
  }

  function addMapping(m: Omit<GamepadMapping, 'id'>): GamepadMapping {
    const created: GamepadMapping = { ...m, id: `gp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
    mappings.value.push(created)
    save()
    return created
  }

  function updateMapping(id: string, updates: Partial<Omit<GamepadMapping, 'id'>>) {
    const idx = mappings.value.findIndex(m => m.id === id)
    if (idx >= 0) {
      mappings.value[idx] = { ...mappings.value[idx], ...updates }
      save()
    }
  }

  function deleteMapping(id: string) {
    mappings.value = mappings.value.filter(m => m.id !== id)
    save()
  }

  function loadDefaults() {
    mappings.value = [...DEFAULT_MAPPINGS]
    save()
  }

  function clearAll() {
    mappings.value = []
    save()
  }

  function startLearning(cb: (e: { control: 'button' | 'axis', index: number }) => void) {
    isLearning.value = true
    learningCallback.value = cb
  }

  function cancelLearning() {
    isLearning.value = false
    learningCallback.value = null
  }

  return {
    mappings,
    isLearning,
    lastTriggeredMappingId,
    connected: gamepad.isConnected,
    devices: gamepad.devices,
    liveButtons: gamepad.buttons,
    liveAxes: gamepad.axes,
    addMapping,
    updateMapping,
    deleteMapping,
    loadDefaults,
    clearAll,
    startLearning,
    cancelLearning,
  }
}
