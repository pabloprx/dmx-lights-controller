import { ref, computed } from "vue";

export interface SerialOptions {
  baudRate?: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
}

const DEFAULT_OPTIONS: SerialOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  bufferSize: 255,
};

// Shared state across components
const port = ref<SerialPort | null>(null);
const reader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null);
const writer = ref<WritableStreamDefaultWriter<Uint8Array> | null>(null);
const isConnected = ref(false);
const isConnecting = ref(false);
const error = ref<string | null>(null);
const receivedData = ref<string>("");

export function useSerial() {
  const isSupported = computed(() => "serial" in navigator);

  async function connect(options: SerialOptions = {}) {
    if (!isSupported.value) {
      error.value = "Web Serial API not supported in this browser";
      return false;
    }

    if (isConnected.value || isConnecting.value) return true;

    isConnecting.value = true;
    error.value = null;

    try {
      // Request port from user
      const selectedPort = await navigator.serial.requestPort();
      port.value = selectedPort;

      // Open the port
      await selectedPort.open({ ...DEFAULT_OPTIONS, ...options });

      // Set up reader
      if (selectedPort.readable) {
        reader.value = selectedPort.readable.getReader();
        readLoop();
      }

      // Set up writer
      if (selectedPort.writable) {
        writer.value = selectedPort.writable.getWriter();
      }

      isConnected.value = true;
      console.log("[Serial] Connected");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect";
      error.value = msg;
      console.error("[Serial] Connection error:", e);
      return false;
    } finally {
      isConnecting.value = false;
    }
  }

  async function disconnect() {
    try {
      if (reader.value) {
        await reader.value.cancel();
        reader.value.releaseLock();
        reader.value = null;
      }

      if (writer.value) {
        await writer.value.close();
        writer.value.releaseLock();
        writer.value = null;
      }

      if (port.value) {
        await port.value.close();
        port.value = null;
      }

      isConnected.value = false;
      console.log("[Serial] Disconnected");
    } catch (e) {
      console.error("[Serial] Disconnect error:", e);
    }
  }

  async function readLoop() {
    while (reader.value && isConnected.value) {
      try {
        const { value, done } = await reader.value.read();
        if (done) break;
        if (value) {
          const text = new TextDecoder().decode(value);
          receivedData.value += text;
          // Keep last 1000 chars
          if (receivedData.value.length > 1000) {
            receivedData.value = receivedData.value.slice(-1000);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "NetworkError") {
          console.error("[Serial] Read error:", e);
        }
        break;
      }
    }
  }

  async function write(data: string | Uint8Array) {
    if (!writer.value || !isConnected.value) {
      error.value = "Not connected";
      return false;
    }

    try {
      const bytes = typeof data === "string"
        ? new TextEncoder().encode(data)
        : data;
      await writer.value.write(bytes);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Write failed";
      error.value = msg;
      console.error("[Serial] Write error:", e);
      return false;
    }
  }

  // Send DMX-style command: channel, value (0-255)
  async function sendDMX(channel: number, value: number) {
    // Simple protocol: "D<channel>,<value>\n"
    const cmd = `D${channel},${Math.min(255, Math.max(0, Math.round(value)))}\n`;
    return write(cmd);
  }

  // Send beat sync trigger
  async function sendBeat(beatInBar: number, tempo: number) {
    // Protocol: "B<beatInBar>,<tempo>\n"
    const cmd = `B${beatInBar},${tempo.toFixed(1)}\n`;
    return write(cmd);
  }

  // Send full scene (array of channel values)
  async function sendScene(channelValues: number[]) {
    // Protocol: "S<v1>,<v2>,...<vN>\n"
    const values = channelValues.map(v => Math.min(255, Math.max(0, Math.round(v))));
    const cmd = `S${values.join(',')}\n`;
    return write(cmd);
  }

  return {
    // State
    isSupported,
    isConnected,
    isConnecting,
    error,
    receivedData,
    // Methods
    connect,
    disconnect,
    write,
    sendDMX,
    sendBeat,
    sendScene,
  };
}
