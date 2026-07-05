// Tests for app/lib/midiMath.ts (mirrors useMIDI.ts decode helpers).

import { describe, it, expect } from 'vitest'
import { midiNoteToName, parseMIDIStatus, ccToValue01 } from '~/lib/midiMath'

describe('midiNoteToName', () => {
  it('maps 60 -> C4 (middle C)', () => {
    expect(midiNoteToName(60)).toBe('C4')
  })

  it('maps note 0 -> C-1 and 69 -> A4', () => {
    expect(midiNoteToName(0)).toBe('C-1')
    expect(midiNoteToName(69)).toBe('A4')
    expect(midiNoteToName(61)).toBe('C#4')
  })
})

describe('parseMIDIStatus', () => {
  it('decodes Note On (0x90) with velocity > 0 as noteon', () => {
    const e = parseMIDIStatus([0x90, 60, 100])
    expect(e.type).toBe('noteon')
    expect(e.note).toBe(60)
    expect(e.noteName).toBe('C4')
    expect(e.velocity).toBe(100)
    expect(e.channel).toBe(1)
  })

  it('decodes Note On (0x90) with velocity 0 as noteoff', () => {
    const e = parseMIDIStatus([0x90, 60, 0])
    expect(e.type).toBe('noteoff')
    expect(e.velocity).toBe(0)
  })

  it('decodes Note Off (0x80) as noteoff', () => {
    const e = parseMIDIStatus([0x80, 64, 40])
    expect(e.type).toBe('noteoff')
    expect(e.note).toBe(64)
  })

  it('decodes Control Change (0xB0) as cc', () => {
    const e = parseMIDIStatus([0xb0, 74, 127])
    expect(e.type).toBe('cc')
    expect(e.cc).toBe(74)
    expect(e.value).toBe(127)
  })

  it('decodes Pitch Bend (0xE0) as (msb << 7) | lsb', () => {
    // lsb = data[1], msb = data[2]
    const e = parseMIDIStatus([0xe0, 0x00, 0x40])
    expect(e.type).toBe('pitchbend')
    expect(e.pitchBend).toBe((0x40 << 7) | 0x00) // 8192, center
    expect(parseMIDIStatus([0xe0, 0x7f, 0x7f]).pitchBend).toBe((0x7f << 7) | 0x7f) // 16383, max
  })

  it('derives channel as (status & 0x0f) + 1', () => {
    expect(parseMIDIStatus([0x90, 60, 100]).channel).toBe(1) // 0x90 -> ch 1
    expect(parseMIDIStatus([0x95, 60, 100]).channel).toBe(6) // 0x95 -> ch 6
    expect(parseMIDIStatus([0xbf, 1, 1]).channel).toBe(16) // 0xBF -> ch 16
  })

  it('returns unknown for unrecognized status bytes', () => {
    const e = parseMIDIStatus([0xf0, 0, 0])
    expect(e.type).toBe('unknown')
  })
})

describe('ccToValue01', () => {
  it('normalizes 0 -> 0, 127 -> 1', () => {
    expect(ccToValue01(0)).toBe(0)
    expect(ccToValue01(127)).toBe(1)
  })

  it('normalizes midpoint', () => {
    expect(ccToValue01(64)).toBeCloseTo(64 / 127, 6)
  })
})
