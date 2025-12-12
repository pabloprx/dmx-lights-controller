import type { AudioLevels } from './useUnifiedSerial'

const audioLevels = ref<AudioLevels>({ bass: 0, mid: 0, high: 0 })
const isConnected = ref(false)
const port = ref<SerialPort | null>(null)
const reader = ref<ReadableStreamDefaultReader<string> | null>(null)

let buffer = ''

export function useAudioSerial() {
  async function connect() {
    if (!('serial' in navigator)) {
      console.error('Web Serial API not supported')
      return
    }

    try {
      const selectedPort = await navigator.serial.requestPort()
      await selectedPort.open({ baudRate: 115200 })
      port.value = selectedPort

      isConnected.value = true
      readLoop()
    } catch (error) {
      console.error('Failed to connect to audio serial:', error)
    }
  }

  async function disconnect() {
    if (reader.value) {
      await reader.value.cancel()
      reader.value = null
    }

    if (port.value) {
      await port.value.close()
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
      console.error('Audio serial read error:', error)
    } finally {
      reader.value?.releaseLock()
      await readableStreamClosed.catch(() => {})
    }
  }

  function parseLine(line: string) {
    // Try JSON format: {"bass":50,"mid":30,"high":20}
    if (line.startsWith('{')) {
      try {
        const data = JSON.parse(line)
        if (typeof data.bass === 'number' && typeof data.mid === 'number' && typeof data.high === 'number') {
          audioLevels.value = { bass: data.bass, mid: data.mid, high: data.high }
        }
      } catch {
        // Invalid JSON, ignore
      }
      return
    }

    // Try text format: "Bass: 50 | Mid: 30 | High: 20"
    const match = line.match(/Bass:\s*(\d+)\s*\|\s*Mid:\s*(\d+)\s*\|\s*High:\s*(\d+)/)
    if (match) {
      audioLevels.value = {
        bass: parseInt(match[1], 10),
        mid: parseInt(match[2], 10),
        high: parseInt(match[3], 10),
      }
    }
  }

  return {
    audioLevels: readonly(audioLevels),
    isConnected: readonly(isConnected),
    connect,
    disconnect,
  }
}
