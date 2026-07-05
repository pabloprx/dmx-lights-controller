// Serial frame pump - latest-wins coalescing writer for the ESP32 DMX link.
//
// Problem it solves: at 115200 baud a 100-channel CSV frame costs ~26-35ms of
// wire time. Producers (beat steps, audio-reactive updates, gamepad washes) can
// emit frames far faster than that. Writing every frame queues them in the
// WritableStream and the rig drifts seconds behind the beat. A light show needs
// the FRESHEST frame, not every frame - so this pump keeps a single in-flight
// write and coalesces everything that arrives meanwhile down to the newest one.
// Worst-case staleness = one frame of wire time; queue depth is always <= 1.

export interface FramePump {
  /** Queue a frame; replaces any not-yet-written pending frame (latest wins). */
  push(frame: number[]): void
  /** Frames handed to write() so far (diagnostics). */
  writes(): number
  /** Frames replaced before hitting the wire (diagnostics). */
  dropped(): number
  /** True while a write is on the wire or a frame is pending. */
  busy(): boolean
  /** Resolves once everything queued so far has been written. */
  idle(): Promise<void>
}

export function createFramePump(
  write: (frame: number[]) => Promise<void>,
  opts: { minIntervalMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): FramePump {
  const minInterval = opts.minIntervalMs ?? 0
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))

  let pending: number[] | null = null
  let running = false
  let lastWriteAt = -Infinity
  let nWrites = 0
  let nDropped = 0
  let idleResolvers: (() => void)[] = []

  async function run() {
    running = true
    try {
      while (pending) {
        const wait = minInterval - (now() - lastWriteAt)
        if (wait > 0) await sleep(wait)
        // Take the freshest frame AFTER the pacing wait (more may have arrived).
        const frame = pending
        pending = null
        lastWriteAt = now()
        nWrites++
        try {
          await write(frame)
        } catch {
          // Write failures (device unplugged mid-write) must not kill the pump;
          // the connection layer notices via its own disconnect handling.
        }
      }
    } finally {
      running = false
      const rs = idleResolvers
      idleResolvers = []
      for (const r of rs) r()
    }
  }

  return {
    push(frame: number[]) {
      if (pending) nDropped++
      pending = frame
      if (!running) void run()
    },
    writes: () => nWrites,
    dropped: () => nDropped,
    busy: () => running || pending !== null,
    idle: () => (running || pending ? new Promise<void>(r => idleResolvers.push(r)) : Promise.resolve()),
  }
}
