// Tests for app/lib/serialPump.ts (latest-wins coalescing serial writer).

import { describe, it, expect } from 'vitest'
import { createFramePump } from '~/lib/serialPump'

function frame(v: number): number[] {
  return new Array(100).fill(v)
}

// A write fn we can resolve manually, to simulate slow wire time.
function manualWrite() {
  const calls: number[][] = []
  let release: (() => void) | null = null
  const write = (f: number[]) => {
    calls.push(f)
    return new Promise<void>(r => { release = r })
  }
  return { calls, write, finish: () => { release?.(); release = null } }
}

describe('createFramePump', () => {
  it('writes a pushed frame', async () => {
    const calls: number[][] = []
    const pump = createFramePump(async f => { calls.push(f) })
    pump.push(frame(1))
    await pump.idle()
    expect(calls.length).toBe(1)
    expect(calls[0]![0]).toBe(1)
  })

  it('coalesces frames pushed while a write is in flight (latest wins)', async () => {
    const m = manualWrite()
    const pump = createFramePump(m.write)
    pump.push(frame(1)) // starts writing immediately
    pump.push(frame(2)) // queued
    pump.push(frame(3)) // replaces 2
    pump.push(frame(4)) // replaces 3
    expect(m.calls.length).toBe(1)
    m.finish() // finish write of frame 1
    await Promise.resolve() // let the loop take the pending frame
    await Promise.resolve()
    expect(m.calls.length).toBe(2)
    expect(m.calls[1]![0]).toBe(4) // 2 and 3 never hit the wire
    m.finish()
    await pump.idle()
    expect(pump.writes()).toBe(2)
    expect(pump.dropped()).toBe(2)
  })

  it('queue depth never exceeds one pending frame', async () => {
    const m = manualWrite()
    const pump = createFramePump(m.write)
    for (let i = 0; i < 50; i++) pump.push(frame(i))
    expect(m.calls.length).toBe(1) // one in flight
    m.finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(m.calls.length).toBe(2) // exactly one more (the freshest)
    expect(m.calls[1]![0]).toBe(49)
    m.finish()
    await pump.idle()
  })

  it('respects the minimum write interval (pacing)', async () => {
    let t = 0
    const slept: number[] = []
    const calls: number[][] = []
    const pump = createFramePump(async f => { calls.push(f) }, {
      minIntervalMs: 25,
      now: () => t,
      sleep: async ms => { slept.push(ms); t += ms },
    })
    pump.push(frame(1))
    await pump.idle()
    pump.push(frame(2)) // immediately after: must wait out the interval
    await pump.idle()
    expect(calls.length).toBe(2)
    expect(slept.some(ms => ms > 0 && ms <= 25)).toBe(true)
  })

  it('survives write failures and keeps pumping', async () => {
    let fail = true
    const calls: number[][] = []
    const pump = createFramePump(async f => {
      if (fail) { fail = false; throw new Error('unplugged') }
      calls.push(f)
    })
    pump.push(frame(1)) // fails silently
    await pump.idle()
    pump.push(frame(2)) // must still work
    await pump.idle()
    expect(calls.length).toBe(1)
    expect(calls[0]![0]).toBe(2)
  })

  it('busy/idle reflect pump state', async () => {
    const m = manualWrite()
    const pump = createFramePump(m.write)
    expect(pump.busy()).toBe(false)
    pump.push(frame(1))
    expect(pump.busy()).toBe(true)
    m.finish()
    await pump.idle()
    expect(pump.busy()).toBe(false)
  })
})
