// Unified Serial - handles both audio input (JSON) and DMX output (CSV)
// Works with dmx_controller.ino on ESP32

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

let buffer = ''
const STORAGE_KEY = 'dmx-audio-config'

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

      // Start read loop for audio input
      readLoop()

      // Load saved config and sync with Arduino
      loadConfigFromStorage()
      // Give Arduino a moment to initialize, then request its config
      setTimeout(() => {
        requestConfig()
      }, 500)

      return true
    } catch (error) {
      console.error('Failed to connect:', error)
      return false
    }
  }

  async function disconnect() {
    if (reader.value) {
      try {
        await reader.value.cancel()
      } catch {}
      reader.value = null
    }

    if (writer.value) {
      try {
        writer.value.releaseLock()
      } catch {}
      writer.value = null
    }

    if (port.value) {
      try {
        await port.value.close()
      } catch {}
      port.value = null
    }

    isConnected.value = false
    audioLevels.value = { bass: 0, mid: 0, high: 0 }
    console.log('Serial disconnected')
  }

  async function readLoop() {
    if (!port.value?.readable) return

    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = port.value.readable.pipeTo(textDecoder.writable)
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
      console.error('Serial read error:', error)
    } finally {
      reader.value?.releaseLock()
      await readableStreamClosed.catch(() => {})
    }
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
    if (!writer.value || !isConnected.value) return

    // Pad to 100 channels
    const padded = [...channels]
    while (padded.length < 100) padded.push(0)

    const csv = padded.slice(0, 100).join(',') + '\n'
    const encoder = new TextEncoder()

    try {
      await writer.value.write(encoder.encode(csv))
    } catch (error) {
      console.error('Failed to send DMX:', error)
    }
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
