<script setup lang="ts">
const { audioLevels, isConnected, connect, disconnect } = useAudioSerial()

const maxHistory = 50
const bassHistory = ref<number[]>([])
const midHistory = ref<number[]>([])
const highHistory = ref<number[]>([])

watch(audioLevels, (levels) => {
  bassHistory.value.push(levels.bass)
  midHistory.value.push(levels.mid)
  highHistory.value.push(levels.high)

  if (bassHistory.value.length > maxHistory) bassHistory.value.shift()
  if (midHistory.value.length > maxHistory) midHistory.value.shift()
  if (highHistory.value.length > maxHistory) highHistory.value.shift()
}, { deep: true })
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-8">Mic Test</h1>

      <!-- Connection -->
      <div class="mb-8">
        <button
          v-if="!isConnected"
          class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
          @click="connect()"
        >
          Connect ESP32 Mic
        </button>
        <button
          v-else
          class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
          @click="disconnect()"
        >
          Disconnect
        </button>
        <span v-if="isConnected" class="ml-4 text-green-400">Connected</span>
      </div>

      <!-- Live Bars -->
      <div class="bg-neutral-900 rounded-xl p-6 mb-8">
        <h2 class="text-lg font-semibold mb-4 text-neutral-400">Live Levels</h2>
        <div class="flex items-end gap-8 h-64">
          <!-- Bass -->
          <div class="flex-1 flex flex-col items-center gap-2">
            <div class="w-full bg-neutral-800 rounded-lg h-48 relative overflow-hidden">
              <div
                class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-600 to-red-400 transition-all duration-75 rounded-lg"
                :style="{ height: `${audioLevels.bass}%` }"
              />
            </div>
            <span class="text-2xl font-bold font-mono">{{ audioLevels.bass }}</span>
            <span class="text-sm text-neutral-500">BASS</span>
          </div>

          <!-- Mid -->
          <div class="flex-1 flex flex-col items-center gap-2">
            <div class="w-full bg-neutral-800 rounded-lg h-48 relative overflow-hidden">
              <div
                class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-600 to-green-400 transition-all duration-75 rounded-lg"
                :style="{ height: `${audioLevels.mid}%` }"
              />
            </div>
            <span class="text-2xl font-bold font-mono">{{ audioLevels.mid }}</span>
            <span class="text-sm text-neutral-500">MID</span>
          </div>

          <!-- High -->
          <div class="flex-1 flex flex-col items-center gap-2">
            <div class="w-full bg-neutral-800 rounded-lg h-48 relative overflow-hidden">
              <div
                class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-75 rounded-lg"
                :style="{ height: `${audioLevels.high}%` }"
              />
            </div>
            <span class="text-2xl font-bold font-mono">{{ audioLevels.high }}</span>
            <span class="text-sm text-neutral-500">HIGH</span>
          </div>
        </div>
      </div>

      <!-- History Waveform -->
      <div class="bg-neutral-900 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4 text-neutral-400">History</h2>
        <div class="space-y-4">
          <!-- Bass History -->
          <div class="flex items-center gap-4">
            <span class="w-12 text-sm text-red-400">Bass</span>
            <div class="flex-1 h-8 bg-neutral-800 rounded flex items-end gap-px">
              <div
                v-for="(val, i) in bassHistory"
                :key="i"
                class="flex-1 bg-red-500 rounded-t"
                :style="{ height: `${val}%` }"
              />
            </div>
          </div>

          <!-- Mid History -->
          <div class="flex items-center gap-4">
            <span class="w-12 text-sm text-green-400">Mid</span>
            <div class="flex-1 h-8 bg-neutral-800 rounded flex items-end gap-px">
              <div
                v-for="(val, i) in midHistory"
                :key="i"
                class="flex-1 bg-green-500 rounded-t"
                :style="{ height: `${val}%` }"
              />
            </div>
          </div>

          <!-- High History -->
          <div class="flex items-center gap-4">
            <span class="w-12 text-sm text-blue-400">High</span>
            <div class="flex-1 h-8 bg-neutral-800 rounded flex items-end gap-px">
              <div
                v-for="(val, i) in highHistory"
                :key="i"
                class="flex-1 bg-blue-500 rounded-t"
                :style="{ height: `${val}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Raw JSON -->
      <div class="mt-8 bg-neutral-900 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-2 text-neutral-400">Raw Data</h2>
        <pre class="font-mono text-sm text-neutral-300">{{ JSON.stringify(audioLevels, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
