// Unified Serial - handles both audio input (JSON) and DMX output (CSV)
// Works with dmx_controller.ino on ESP32

export interface AudioLevels {
  bass: number
  mid: number
  high: number
}

const audioLevels = ref<AudioLevels>({ bass: 0, mid: 0, high: 0 })
const isConnected = ref(false)
const port = ref<SerialPort | null>(null)
const writer = ref<WritableStreamDefaultWriter<Uint8Array> | null>(null)
const reader = ref<ReadableStreamDefaultReader<string> | null>(null)

let buffer = ''

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

      // Start read loop for audio input
      readLoop()

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
      // Connection closed or error
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

    // Pad to 16 channels
    const padded = [...channels]
    while (padded.length < 16) padded.push(0)

    const csv = padded.slice(0, 16).join(',') + '\n'
    const encoder = new TextEncoder()

    try {
      await writer.value.write(encoder.encode(csv))
    } catch (error) {
      console.error('Failed to send DMX:', error)
    }
  }

  return {
    audioLevels: readonly(audioLevels),
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    sendDMX,
  }
}
