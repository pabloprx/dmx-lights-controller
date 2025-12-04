// DMX Serial - handles DMX output to ESP32
// Works with dmx_controller.ino (output-only mode)

const isConnected = ref(false)
const port = ref<SerialPort | null>(null)
const writer = ref<WritableStreamDefaultWriter<Uint8Array> | null>(null)

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
      console.log('DMX Serial connected')

      return true
    } catch (error) {
      console.error('Failed to connect:', error)
      return false
    }
  }

  async function disconnect() {
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
    console.log('DMX Serial disconnected')
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
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    sendDMX,
  }
}
