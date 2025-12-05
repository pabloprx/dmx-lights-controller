// ═══════════════════════════════════════════════════════════════
// MIDI INPUT COMPOSABLE
// Uses Web MIDI API to capture MIDI events from controllers
// ═══════════════════════════════════════════════════════════════

export interface MIDIEvent {
  id: string
  timestamp: number
  type: 'noteon' | 'noteoff' | 'cc' | 'pitchbend' | 'unknown'
  channel: number
  // For notes
  note?: number
  noteName?: string
  velocity?: number
  // For CC
  cc?: number
  value?: number
  // For pitch bend
  pitchBend?: number
  // Raw data
  raw: number[]
  deviceName: string
}

export interface MIDIDevice {
  id: string
  name: string
  manufacturer: string
  connected: boolean
}

// Note name lookup
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1
  const noteName = NOTE_NAMES[note % 12]
  return `${noteName}${octave}`
}

// Singleton state
const isSupported = ref(false)
const isConnected = ref(false)
const devices = ref<MIDIDevice[]>([])
const events = ref<MIDIEvent[]>([])
const lastEvent = ref<MIDIEvent | null>(null)

// Track active inputs
let midiAccess: MIDIAccess | null = null
const activeInputs = new Map<string, MIDIInput>()

const MAX_EVENTS = 1000

function generateEventId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function parseMIDIMessage(data: Uint8Array, deviceName: string): MIDIEvent {
  const status = data[0]
  const channel = (status & 0x0f) + 1
  const messageType = status & 0xf0

  const event: MIDIEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    type: 'unknown',
    channel,
    raw: Array.from(data),
    deviceName,
  }

  switch (messageType) {
    case 0x90: // Note On
      event.type = data[2] > 0 ? 'noteon' : 'noteoff'
      event.note = data[1]
      event.noteName = midiNoteToName(data[1])
      event.velocity = data[2]
      break
    case 0x80: // Note Off
      event.type = 'noteoff'
      event.note = data[1]
      event.noteName = midiNoteToName(data[1])
      event.velocity = data[2]
      break
    case 0xb0: // Control Change
      event.type = 'cc'
      event.cc = data[1]
      event.value = data[2]
      break
    case 0xe0: // Pitch Bend
      event.type = 'pitchbend'
      event.pitchBend = (data[2] << 7) | data[1]
      break
  }

  return event
}

function handleMIDIMessage(deviceName: string) {
  return (event: MIDIMessageEvent) => {
    if (!event.data) return

    const parsed = parseMIDIMessage(event.data, deviceName)
    lastEvent.value = parsed
    events.value.unshift(parsed)

    // Trim history
    if (events.value.length > MAX_EVENTS) {
      events.value = events.value.slice(0, MAX_EVENTS)
    }
  }
}

function updateDeviceList() {
  if (!midiAccess) return

  const newDevices: MIDIDevice[] = []

  midiAccess.inputs.forEach((input) => {
    newDevices.push({
      id: input.id,
      name: input.name || 'Unknown Device',
      manufacturer: input.manufacturer || 'Unknown',
      connected: input.state === 'connected',
    })
  })

  devices.value = newDevices
}

function attachInputListeners() {
  if (!midiAccess) return

  // Detach old listeners
  activeInputs.forEach((input) => {
    input.onmidimessage = null
  })
  activeInputs.clear()

  // Attach new listeners
  midiAccess.inputs.forEach((input) => {
    if (input.state === 'connected') {
      input.onmidimessage = handleMIDIMessage(input.name || 'Unknown')
      activeInputs.set(input.id, input)
    }
  })

  isConnected.value = activeInputs.size > 0
}

async function connect(): Promise<boolean> {
  if (!navigator.requestMIDIAccess) {
    console.error('Web MIDI API not supported')
    isSupported.value = false
    return false
  }

  isSupported.value = true

  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false })

    // Listen for device changes
    midiAccess.onstatechange = () => {
      updateDeviceList()
      attachInputListeners()
    }

    updateDeviceList()
    attachInputListeners()

    return true
  } catch (err) {
    console.error('Failed to access MIDI devices:', err)
    return false
  }
}

function disconnect() {
  activeInputs.forEach((input) => {
    input.onmidimessage = null
  })
  activeInputs.clear()
  isConnected.value = false
}

function clearEvents() {
  events.value = []
  lastEvent.value = null
}

export function useMIDI() {
  return {
    // State
    isSupported: readonly(isSupported),
    isConnected: readonly(isConnected),
    devices: readonly(devices),
    events: readonly(events),
    lastEvent: readonly(lastEvent),

    // Actions
    connect,
    disconnect,
    clearEvents,
  }
}
