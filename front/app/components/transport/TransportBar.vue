<script setup lang="ts">
const { state: linkState, connected } = useAbletonLink()
const { isConnected: serialConnected, connect: connectSerial, audioLevels } = useUnifiedSerial()
</script>

<template>
  <div class="flex items-center gap-5 px-4 py-3 bg-neutral-900 border-b border-neutral-700">
    <!-- Play/Pause + BPM -->
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 flex items-center justify-center rounded text-base"
        :class="linkState.isPlaying ? 'bg-green-500 text-black' : 'bg-neutral-800 text-neutral-500'"
      >
        {{ linkState.isPlaying ? '▶' : '⏸' }}
      </div>
      <div class="text-xl font-bold font-mono min-w-[100px]">{{ linkState.tempo.toFixed(1) }} BPM</div>
    </div>

    <!-- Beat Indicator -->
    <div class="flex items-center gap-2">
      <div
        v-for="i in 4"
        :key="i"
        class="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
        :class="linkState.isPlaying && linkState.beatInBar === i ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-600'"
      >
        {{ i }}
      </div>
    </div>

    <!-- Audio Levels -->
    <div v-if="serialConnected" class="flex items-center gap-3 px-3 py-1 bg-neutral-800 rounded">
      <!-- Bass -->
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-red-400 w-4">B</span>
        <div class="w-16 h-3 bg-neutral-700 rounded overflow-hidden">
          <div
            class="h-full bg-red-500 transition-all duration-75"
            :style="{ width: `${audioLevels.bass}%` }"
          />
        </div>
      </div>
      <!-- Mid -->
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-green-400 w-4">M</span>
        <div class="w-16 h-3 bg-neutral-700 rounded overflow-hidden">
          <div
            class="h-full bg-green-500 transition-all duration-75"
            :style="{ width: `${audioLevels.mid}%` }"
          />
        </div>
      </div>
      <!-- High -->
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-blue-400 w-4">H</span>
        <div class="w-16 h-3 bg-neutral-700 rounded overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-75"
            :style="{ width: `${audioLevels.high}%` }"
          />
        </div>
      </div>
    </div>

    <div class="flex-1" />

    <!-- Status -->
    <div class="flex items-center gap-3">
      <div
        class="text-xs px-2 py-1 rounded"
        :class="connected ? 'text-green-500 bg-neutral-800' : 'text-neutral-500 bg-neutral-800'"
      >
        Link: {{ connected ? linkState.numPeers : '–' }}
      </div>
      <button
        v-if="!serialConnected"
        class="bg-neutral-700 text-white border-none px-3 py-1.5 rounded text-xs cursor-pointer hover:bg-neutral-600"
        @click="connectSerial()"
      >
        Connect Serial
      </button>
      <div v-else class="text-xs px-2 py-1 rounded text-green-500 bg-neutral-800">Serial: OK</div>
    </div>
  </div>
</template>
