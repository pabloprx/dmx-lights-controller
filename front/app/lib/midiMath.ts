// Pure MIDI message decoding, extracted for unit testing without Web MIDI / Nuxt globals.
// mirrors app/composables/useMIDI.ts:33-96

// Note name lookup
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// mirrors useMIDI.ts:34-38
export function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1
  const noteName = NOTE_NAMES[note % 12]
  return `${noteName}${octave}`
}

export type MIDIStatusType = 'noteon' | 'noteoff' | 'cc' | 'pitchbend' | 'unknown'

export interface MIDIStatus {
  type: MIDIStatusType
  channel: number
  note?: number
  noteName?: string
  velocity?: number
  cc?: number
  value?: number
  pitchBend?: number
}

// Decode a raw MIDI status message into a typed event (no id/timestamp/raw).
// mirrors useMIDI.ts:57-96 (parseMIDIMessage)
export function parseMIDIStatus(data: number[]): MIDIStatus {
  const status = data[0]
  const channel = (status & 0x0f) + 1
  const messageType = status & 0xf0

  const event: MIDIStatus = {
    type: 'unknown',
    channel,
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

// Normalize a 7-bit CC value (0-127) to 0-1, matching the master:dimmer mapping intent.
export function ccToValue01(v: number): number {
  return v / 127
}
