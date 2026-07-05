// ═══════════════════════════════════════════════════════════════
// GAMEPAD INPUT (Xbox controller etc.)
// Polls navigator.getGamepads() on rAF, emits NORMALIZED events.
// Buttons report 0..1 (analog triggers are buttons 6/7 on a standard pad).
// Axes report -1..1 (sticks). The mapper/visualizer decide what to do.
// ═══════════════════════════════════════════════════════════════

export interface GamepadInputEvent {
  id: string
  source: 'gamepad'
  kind: 'button' | 'axis'
  index: number
  value: number        // button: 0..1 | axis: -1..1
  pressed: boolean     // rising/falling edge state
  gamepadIndex: number
  timestamp: number
}

export interface GamepadDeviceInfo {
  index: number
  id: string
}

// Standard Xbox/standard-mapping button index -> short label (for the config UI)
export const XBOX_BUTTON_LABELS: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3',
  12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right', 16: 'Guide', 17: 'Share',
}
export const XBOX_AXIS_LABELS: Record<number, string> = {
  0: 'L-Stick X', 1: 'L-Stick Y', 2: 'R-Stick X', 3: 'R-Stick Y',
}

// Singleton state
const isSupported = ref(false)
const isConnected = ref(false)
const devices = ref<GamepadDeviceInfo[]>([])
const lastEvent = ref<GamepadInputEvent | null>(null)
const buttons = ref<number[]>([])   // live values of first connected pad
const axes = ref<number[]>([])

const ANALOG_EPSILON = 0.03
const AXIS_EPSILON = 0.06
const AXIS_DEADZONE = 0.2

let rafId: number | null = null
let running = false
const prevPressed: Record<number, boolean[]> = {}
const prevButtonVals: Record<number, number[]> = {}
const prevAxes: Record<number, number[]> = {}

function eventId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Synchronous subscribers get EVERY event. lastEvent (a ref) only keeps the most
// recent for the learn UI; relying on a watch of it drops events when several
// fire in one poll frame (e.g. releasing one button while pressing another),
// which causes stuck/missed live-perform actions. The mapper subscribes instead.
const eventSubscribers = new Set<(e: GamepadInputEvent) => void>()

function emit(e: Omit<GamepadInputEvent, 'id' | 'source' | 'timestamp'>) {
  const full: GamepadInputEvent = { id: eventId(), source: 'gamepad', timestamp: performance.now(), ...e }
  lastEvent.value = full
  for (const cb of eventSubscribers) cb(full)
}

function poll() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    running = false
    return
  }

  const pads = navigator.getGamepads()
  const connected: GamepadDeviceInfo[] = []

  for (const pad of pads) {
    if (!pad) continue
    connected.push({ index: pad.index, id: pad.id })

    const pb = prevPressed[pad.index] || []
    const pv = prevButtonVals[pad.index] || []
    pad.buttons.forEach((btn, i) => {
      const wasPressed = pb[i] || false
      const prevVal = pv[i] ?? 0
      // Emit on digital edge OR meaningful analog change (for triggers).
      if (btn.pressed !== wasPressed || Math.abs(btn.value - prevVal) > ANALOG_EPSILON) {
        emit({ kind: 'button', index: i, value: btn.value, pressed: btn.pressed, gamepadIndex: pad.index })
      }
    })
    prevPressed[pad.index] = pad.buttons.map(b => b.pressed)
    prevButtonVals[pad.index] = pad.buttons.map(b => b.value)

    const pa = prevAxes[pad.index] || []
    pad.axes.forEach((ax, i) => {
      const prev = pa[i] ?? 0
      if (Math.abs(ax - prev) > AXIS_EPSILON) {
        emit({ kind: 'axis', index: i, value: ax, pressed: Math.abs(ax) > AXIS_DEADZONE, gamepadIndex: pad.index })
      }
    })
    prevAxes[pad.index] = [...pad.axes]

    // Expose live values for the first connected pad (config UI)
    if (pad.index === connected[0]?.index) {
      buttons.value = pad.buttons.map(b => b.value)
      axes.value = [...pad.axes]
    }
  }

  devices.value = connected
  isConnected.value = connected.length > 0
  rafId = requestAnimationFrame(poll)
}

function start() {
  if (running || typeof window === 'undefined') return
  isSupported.value = !!navigator.getGamepads
  if (!isSupported.value) return
  running = true
  window.addEventListener('gamepadconnected', onConnect)
  window.addEventListener('gamepaddisconnected', onDisconnect)
  rafId = requestAnimationFrame(poll)
}

function stop() {
  running = false
  if (rafId != null) cancelAnimationFrame(rafId)
  rafId = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('gamepadconnected', onConnect)
    window.removeEventListener('gamepaddisconnected', onDisconnect)
  }
}

function onConnect() { if (!running) start() }
function onDisconnect() {
  if (typeof navigator !== 'undefined' && navigator.getGamepads) {
    const any = Array.from(navigator.getGamepads()).some(Boolean)
    isConnected.value = any
  }
}

export function useGamepad() {
  return {
    isSupported: readonly(isSupported),
    isConnected: readonly(isConnected),
    devices: readonly(devices),
    lastEvent: readonly(lastEvent),
    buttons: readonly(buttons),
    axes: readonly(axes),
    start,
    stop,
    // Subscribe to EVERY gamepad event synchronously (returns an unsubscribe fn).
    onEvent(cb: (e: GamepadInputEvent) => void) {
      eventSubscribers.add(cb)
      return () => eventSubscribers.delete(cb)
    },
  }
}
