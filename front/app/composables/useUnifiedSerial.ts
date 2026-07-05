// Unified Serial - handles both audio input (JSON) and DMX output (CSV)
// Works with dmx_controller.ino on ESP32

import { createFramePump } from '~/lib/serialPump'
import type { FramePump } from '~/lib/serialPump'

export interface AudioLevels {
  bass: number
  mid: number
  high: number
}

export interface AudioConfig {
  bassMax: number
  midMax: number
  highMax: number
  bassSilence: number
  midSilence: number
  highSilence: number
  noiseFloor: number
}

const DEFAULT_CONFIG: AudioConfig = {
  bassMax: 200000,
  midMax: 300000,
  highMax: 250000,
  bassSilence: 30,
  midSilence: 20,
  highSilence: 25,
  noiseFloor: 15,
}

const audioLevels = ref<AudioLevels>({ bass: 0, mid: 0, high: 0 })
const audioConfig = ref<AudioConfig>({ ...DEFAULT_CONFIG })
const isConnected = ref(false)
const port = ref<SerialPort | null>(null)
const writer = ref<WritableStreamDefaultWriter<Uint8Array> | null>(null)
const reader = ref<ReadableStreamDefaultReader<string> | null>(null)

// RENDER SEAM (single source of truth for "the DMX frame on the wire").
// Every output path (playback engine + testing-mode preset pokes) calls sendDMX,
// which publishes here BEFORE the hardware guard - so the 3D visualizer and any
// consumer see live frames even with NO ESP32 connected (the practice use case).
const currentFrame = ref<number[]>(new Array(100).fill(0))

let buffer = ''
const STORAGE_KEY = 'dmx-audio-config'

// True once the ESP32 has sent its first audio line after connect. Opening the
// port toggles DTR/RTS which auto-resets most devkits; the first line is the
// only reliable "firmware is up" signal (fixed timers race the boot).
const firmwareReady = ref(false)
// pipeTo unwind promise from readLoop; disconnect() must await it before
// port.close() or the readable lock is still held and close() rejects,
// leaving the OS port open until a page reload.
let readableClosed: Promise<void> | null = null

// One encoder for the app lifetime (was one per frame).
const encoder = new TextEncoder()

// Latest-wins write pump: keeps at most ONE frame queued behind the in-flight
// write, so fast producers (audio-reactive, stick washes, quarter-note steps)
// can never pile up latency in the WritableStream. ~30ms wire time per frame at
// 115200 baud is the real pacing; minIntervalMs is a safety net (~45fps cap,
// matching the ESP32's 44Hz DMX refresh - frames above that are invisible).
let pump: FramePump | null = null
function ensurePump(): FramePump {
  if (!pump) {
    pump = createFramePump(async (frame) => {
      const w = writer.value
      if (!w || !isConnected.value) return
      await w.write(encoder.encode(frame.join(',') + '\n'))
    }, { minIntervalMs: 22 })
  }
  return pump
}

// Handle physical unplug: without this, isConnected stays true and every write
// throws forever. Registered once per page.
let unplugHooked = false
function hookUnplug(onDisconnect: () => void) {
  if (unplugHooked || typeof navigator === 'undefined' || !('serial' in navigator)) return
  unplugHooked = true
  ;(navigator as any).serial.addEventListener('disconnect', (e: any) => {
    if (port.value && e.target === port.value) {
      console.warn('[Serial] Device unplugged')
      onDisconnect()
    }
  })
}

export function useUnifiedSerial() {
  async function connect() {
    if (!('serial' in navigator)) {
      console.error('Web Serial API not supported')
      return false
    }

    try {
      const selectedPort = await navigator.serial.requestPort()
      await selectedPort.open({ baudRate: 115200 })
      port.value = selectedPort

      // Setup writer for DMX output
      writer.value = selectedPort.writable?.getWriter() || null

      isConnected.value = true
      console.log('Serial connected')

      hookUnplug(() => { void disconnect() })

      // Start read loop for audio input
      firmwareReady.value = false
      readLoop()

      // Load saved config; the device handshake (CFG:GET + first frame) fires
      // when the ESP32's first audio line arrives - see parseLine. A fixed
      // timer races the devkit's DTR-toggle auto-reset boot and loses.
      loadConfigFromStorage()

      return true
    } catch (error) {
      console.error('Failed to connect:', error)
      return false
    }
  }

  // Teardown order matters (Web Serial rejects close() while streams are
  // locked): drain the write pump, cancel the reader and WAIT for the pipeTo
  // unwind to release the readable lock, close (not release) the writer so the
  // last frame flushes, then close the port. Getting this wrong leaves the OS
  // port open and every reconnect fails until a page reload.
  async function disconnect() {
    // Flip first so readLoop's outer loop and the pump stop producing.
    isConnected.value = false

    if (pump) {
      try { await pump.idle() } catch {}
    }

    if (reader.value) {
      try { await reader.value.cancel() } catch {}
      reader.value = null
    }
    if (readableClosed) {
      await readableClosed.catch(() => {})
      readableClosed = null
    }

    if (writer.value) {
      try { await writer.value.close() } catch {}
      writer.value = null
    }

    if (port.value) {
      try {
        await port.value.close()
      } catch (e) {
        // Do NOT swallow silently - a stuck port must be diagnosable.
        console.error('[Serial] port.close() failed (port may remain held):', e)
      }
      port.value = null
    }

    firmwareReady.value = false
    audioLevels.value = { bass: 0, mid: 0, high: 0 }
    console.log('Serial disconnected')
  }

  async function readLoop() {
    // Outer loop: re-acquire a reader after recoverable read errors (framing/
    // parity/overrun from cheap USB-serial cables surface as reader errors and
    // must not silently kill audio input for the rest of the session).
    while (port.value?.readable && isConnected.value) {
      const textDecoder = new TextDecoderStream()
      readableClosed = port.value.readable.pipeTo(textDecoder.writable).catch(() => {})
      reader.value = textDecoder.readable.getReader()

      try {
        while (true) {
          const { value, done } = await reader.value.read()
          if (done) break

          buffer += value
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            parseLine(line.trim())
          }
        }
      } catch (error) {
        console.error('Serial read error (retrying):', error)
      } finally {
        try { reader.value?.releaseLock() } catch {}
        await readableClosed?.catch(() => {})
      }
    }
    // Read side is dead for good: make it visible instead of freezing stale bars.
    audioLevels.value = { bass: 0, mid: 0, high: 0 }
  }

  function parseLine(line: string) {
    if (!line.startsWith('{')) return

    try {
      const data = JSON.parse(line)

      // Config response from Arduino
      if (data.type === 'config') {
        audioConfig.value = {
          bassMax: data.bassMax ?? DEFAULT_CONFIG.bassMax,
          midMax: data.midMax ?? DEFAULT_CONFIG.midMax,
          highMax: data.highMax ?? DEFAULT_CONFIG.highMax,
          bassSilence: data.bassSilence ?? DEFAULT_CONFIG.bassSilence,
          midSilence: data.midSilence ?? DEFAULT_CONFIG.midSilence,
          highSilence: data.highSilence ?? DEFAULT_CONFIG.highSilence,
          noiseFloor: data.noiseFloor ?? DEFAULT_CONFIG.noiseFloor,
        }
        console.log('[Serial] Config received:', audioConfig.value)
        return
      }

      // Audio levels
      if (
        typeof data.bass === 'number' &&
        typeof data.mid === 'number' &&
        typeof data.high === 'number'
      ) {
        // First line after connect = the firmware survived its DTR auto-reset
        // boot. NOW the handshake is safe: request its config and push the
        // current frame so the rig immediately shows what the app shows
        // (fixes dark-rig-on-connect: the player's dedup was fed while
        // hardware was absent, so nothing re-sends until content changes).
        if (!firmwareReady.value) {
          firmwareReady.value = true
          requestConfig()
          ensurePump().push([...currentFrame.value])
        }
        audioLevels.value = {
          bass: data.bass,
          mid: data.mid,
          high: data.high,
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Send DMX values as CSV: "255,128,0,0,255,0,0,0,0,0,0,0,0,0,0,0\n"
  async function sendDMX(channels: number[]) {
    // Pad/truncate to exactly 100 channels and publish the frame FIRST, so
    // the visualizer renders even when no hardware is attached.
    const padded = [...channels]
    while (padded.length < 100) padded.push(0)
    const frame = padded.slice(0, 100)
    currentFrame.value = frame

    // Hardware is optional: bail out of the write if nothing is connected.
    if (!writer.value || !isConnected.value) return

    // Coalescing pump (latest wins): bounded latency even when producers emit
    // frames faster than the ~30ms wire time. Never blocks the caller.
    ensurePump().push(frame)
  }

  // Request current config from Arduino
  async function requestConfig() {
    if (!writer.value || !isConnected.value) return
    const encoder = new TextEncoder()
    try {
      await writer.value.write(encoder.encode('CFG:GET\n'))
    } catch (error) {
      console.error('Failed to request config:', error)
    }
  }

  // Send a single config value to Arduino
  async function sendConfigValue(key: keyof AudioConfig, value: number) {
    if (!writer.value || !isConnected.value) return
    const encoder = new TextEncoder()
    try {
      await writer.value.write(encoder.encode(`CFG:${key}=${value}\n`))
      // Update local state
      audioConfig.value = { ...audioConfig.value, [key]: value }
      // Save to localStorage
      saveConfigToStorage()
    } catch (error) {
      console.error('Failed to send config:', error)
    }
  }

  // Send all config values to Arduino
  async function syncConfigToArduino() {
    if (!writer.value || !isConnected.value) return
    const encoder = new TextEncoder()
    try {
      for (const [key, value] of Object.entries(audioConfig.value)) {
        await writer.value.write(encoder.encode(`CFG:${key}=${value}\n`))
        // Small delay between commands
        await new Promise(r => setTimeout(r, 50))
      }
      console.log('[Serial] Config synced to Arduino')
    } catch (error) {
      console.error('Failed to sync config:', error)
    }
  }

  // Load config from localStorage
  function loadConfigFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        audioConfig.value = { ...DEFAULT_CONFIG, ...parsed }
        console.log('[Serial] Config loaded from storage:', audioConfig.value)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  // Save config to localStorage
  function saveConfigToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(audioConfig.value))
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  // Reset config to defaults
  function resetConfig() {
    audioConfig.value = { ...DEFAULT_CONFIG }
    saveConfigToStorage()
    syncConfigToArduino()
  }

  return {
    audioLevels: readonly(audioLevels),
    audioConfig: readonly(audioConfig),
    isConnected: readonly(isConnected),
    firmwareReady: readonly(firmwareReady),
    currentFrame: readonly(currentFrame),
    // TX pump stats for hardware bring-up (frames written vs coalesced away).
    getTxStats: () => ({ writes: pump?.writes() ?? 0, dropped: pump?.dropped() ?? 0 }),
    connect,
    disconnect,
    sendDMX,
    requestConfig,
    sendConfigValue,
    syncConfigToArduino,
    resetConfig,
    DEFAULT_CONFIG,
  }
}
