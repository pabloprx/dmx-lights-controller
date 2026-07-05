<script setup lang="ts">
// Raw DMX tester. Uses the SHARED serial singleton: a page-local SerialPort
// leaked on navigate (this is an SPA - the port stayed open with no handle)
// and permanently blocked the controller from connecting. One ESP32, one port.
const serial = useUnifiedSerial()
const { isConnected } = serial
const connect = serial.connect
const disconnect = serial.disconnect

const dimmer = ref(255)
const red = ref(255)
const green = ref(0)
const blue = ref(0)
const white = ref(0)

function sendDMX() {
  // First fixture only (ch1-5); the shared pump pads the frame to 100.
  serial.sendDMX([dimmer.value, red.value, green.value, blue.value, white.value])
}

// Auto-send when values change
watch([dimmer, red, green, blue, white], () => {
  if (isConnected.value) sendDMX()
}, { immediate: false })

// Presets
function setPreset(d: number, r: number, g: number, b: number, w: number) {
  dimmer.value = d
  red.value = r
  green.value = g
  blue.value = b
  white.value = w
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white p-8">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold mb-8">DMX Test</h1>

      <!-- Connection -->
      <div class="mb-8">
        <button
          v-if="!isConnected"
          class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
          @click="connect()"
        >
          Connect DMX
        </button>
        <button
          v-else
          class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
          @click="disconnect()"
        >
          Disconnect
        </button>
        <span v-if="isConnected" class="ml-4 text-green-400">Connected - Sending live</span>
      </div>

      <!-- Sliders -->
      <div class="bg-neutral-900 rounded-xl p-6 mb-8 space-y-6">
        <!-- Dimmer -->
        <div>
          <div class="flex justify-between mb-2">
            <label class="text-neutral-400">Dimmer (CH1)</label>
            <span class="font-mono">{{ dimmer }}</span>
          </div>
          <input
            v-model.number="dimmer"
            type="range"
            min="0"
            max="255"
            class="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        <!-- Red -->
        <div>
          <div class="flex justify-between mb-2">
            <label class="text-red-400">Red (CH2)</label>
            <span class="font-mono">{{ red }}</span>
          </div>
          <input
            v-model.number="red"
            type="range"
            min="0"
            max="255"
            class="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        <!-- Green -->
        <div>
          <div class="flex justify-between mb-2">
            <label class="text-green-400">Green (CH3)</label>
            <span class="font-mono">{{ green }}</span>
          </div>
          <input
            v-model.number="green"
            type="range"
            min="0"
            max="255"
            class="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        <!-- Blue -->
        <div>
          <div class="flex justify-between mb-2">
            <label class="text-blue-400">Blue (CH4)</label>
            <span class="font-mono">{{ blue }}</span>
          </div>
          <input
            v-model.number="blue"
            type="range"
            min="0"
            max="255"
            class="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <!-- White -->
        <div>
          <div class="flex justify-between mb-2">
            <label class="text-neutral-300">White (CH5)</label>
            <span class="font-mono">{{ white }}</span>
          </div>
          <input
            v-model.number="white"
            type="range"
            min="0"
            max="255"
            class="w-full h-3 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-300"
          />
        </div>
      </div>

      <!-- Preview -->
      <div class="mb-8">
        <div
          class="w-32 h-32 rounded-full mx-auto border-4 border-neutral-700"
          :style="{
            backgroundColor: `rgb(${red * dimmer / 255}, ${green * dimmer / 255}, ${blue * dimmer / 255})`,
            boxShadow: `0 0 ${dimmer / 4}px ${dimmer / 8}px rgba(${red}, ${green}, ${blue}, 0.5)`
          }"
        />
      </div>

      <!-- Quick Presets -->
      <div class="bg-neutral-900 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4 text-neutral-400">Quick Presets</h2>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-4 py-2 rounded bg-red-600 hover:bg-red-700"
            @click="setPreset(255, 255, 0, 0, 0)"
          >Red</button>
          <button
            class="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
            @click="setPreset(255, 0, 255, 0, 0)"
          >Green</button>
          <button
            class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
            @click="setPreset(255, 0, 0, 255, 0)"
          >Blue</button>
          <button
            class="px-4 py-2 rounded bg-neutral-200 text-black hover:bg-neutral-300"
            @click="setPreset(255, 0, 0, 0, 255)"
          >White</button>
          <button
            class="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700"
            @click="setPreset(255, 255, 0, 255, 0)"
          >Purple</button>
          <button
            class="px-4 py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-black"
            @click="setPreset(255, 255, 255, 0, 0)"
          >Yellow</button>
          <button
            class="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-black"
            @click="setPreset(255, 0, 255, 255, 0)"
          >Cyan</button>
          <button
            class="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700"
            @click="setPreset(0, 0, 0, 0, 0)"
          >OFF</button>
        </div>
      </div>

      <!-- Raw output -->
      <div class="mt-8 text-xs text-neutral-500 font-mono">
        Sending: {{ [dimmer, red, green, blue, white, 0,0,0,0,0,0,0,0,0,0,0].join(',') }}
      </div>
    </div>
  </div>
</template>
