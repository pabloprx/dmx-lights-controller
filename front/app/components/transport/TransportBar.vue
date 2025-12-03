<script setup lang="ts">
const { state: linkState, connected, connect: connectLink, disconnect: disconnectLink } = useAbletonLink()
const { isConnected: serialConnected, connect: connectSerial, audioLevels } = useUnifiedSerial()
const {
  mode,
  isTestingMode,
  isPerformanceMode,
  canSwitchToPerformance,
  toggleMode,
  blackout,
  toggleBlackout,
  internalTempo,
  internalPlaying,
  internalBeat,
  toggleInternalPlayback,
  setInternalTempo,
  stepBeat,
} = useAppMode()

// Confirmation for exiting performance mode
const showExitConfirm = ref(false)

function handleModeToggle() {
  if (isPerformanceMode.value) {
    showExitConfirm.value = true
  } else {
    toggleMode()
  }
}

function confirmExitPerformance() {
  toggleMode()
  showExitConfirm.value = false
}
</script>

<template>
  <div
    class="flex items-center gap-5 px-4 py-3 bg-neutral-900 border-b-2 transition-colors"
    :class="isPerformanceMode ? 'border-red-500' : 'border-neutral-700'"
  >
    <!-- Play/Pause + BPM (shows Link in performance, internal in testing) -->
    <div class="flex items-center gap-3">
      <!-- Testing mode: internal playback controls -->
      <template v-if="isTestingMode">
        <button
          class="w-8 h-8 flex items-center justify-center rounded text-base cursor-pointer transition-colors"
          :class="internalPlaying ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'"
          @click="toggleInternalPlayback"
        >
          {{ internalPlaying ? '⏸' : '▶' }}
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center rounded text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 cursor-pointer"
          title="Step beat"
          @click="stepBeat"
        >
          ⏭
        </button>
        <input
          type="number"
          :value="internalTempo"
          min="20"
          max="300"
          class="w-16 bg-neutral-800 text-white text-center rounded px-2 py-1 text-sm font-mono"
          @change="(e) => setInternalTempo(Number((e.target as HTMLInputElement).value))"
        />
        <span class="text-neutral-500 text-sm">BPM</span>
        <div class="text-neutral-600 text-xs font-mono ml-2">beat: {{ internalBeat }}</div>
      </template>

      <!-- Performance mode: Link playback status -->
      <template v-else>
        <div
          class="w-8 h-8 flex items-center justify-center rounded text-base"
          :class="linkState.isPlaying ? 'bg-green-500 text-black' : 'bg-neutral-800 text-neutral-500'"
        >
          {{ linkState.isPlaying ? '▶' : '⏸' }}
        </div>
        <div class="text-xl font-bold font-mono min-w-[100px]">{{ linkState.tempo.toFixed(1) }} BPM</div>
      </template>
    </div>

    <!-- Beat Indicator -->
    <div class="flex items-center gap-2">
      <div
        v-for="i in 4"
        :key="i"
        class="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
        :class="
          isPerformanceMode
            ? (linkState.isPlaying && linkState.beatInBar === i ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-600')
            : ((internalPlaying || true) && (internalBeat % 4) + 1 === i ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-600')
        "
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

    <!-- Mode Toggle -->
    <div class="flex items-center gap-2">
      <button
        class="px-3 py-1.5 rounded text-xs font-bold uppercase transition-all"
        :class="
          isTestingMode
            ? 'bg-green-600 text-white'
            : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
        "
        :disabled="isTestingMode"
        @click="handleModeToggle"
      >
        Testing
      </button>
      <button
        class="px-3 py-1.5 rounded text-xs font-bold uppercase transition-all"
        :class="
          isPerformanceMode
            ? 'bg-red-600 text-white animate-pulse'
            : canSwitchToPerformance
              ? 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
              : 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
        "
        :disabled="isPerformanceMode || !canSwitchToPerformance"
        :title="!canSwitchToPerformance ? 'Connect serial first' : ''"
        @click="handleModeToggle"
      >
        {{ isPerformanceMode ? 'LIVE' : 'Perform' }}
      </button>
    </div>

    <!-- Blackout Button -->
    <button
      class="px-4 py-2 rounded font-bold text-sm transition-all"
      :class="
        blackout
          ? 'bg-red-600 text-white ring-2 ring-red-400'
          : 'bg-neutral-800 text-red-400 hover:bg-red-900 hover:text-red-300'
      "
      @click="toggleBlackout"
    >
      {{ blackout ? 'BLACKOUT' : 'BO' }}
    </button>

    <!-- Status -->
    <div class="flex items-center gap-3">
      <!-- Link Connection Button -->
      <button
        class="text-xs px-3 py-1.5 rounded cursor-pointer transition-colors"
        :class="connected ? 'text-green-500 bg-neutral-800 hover:bg-neutral-700' : 'text-neutral-400 bg-neutral-700 hover:bg-neutral-600'"
        @click="connected ? disconnectLink() : connectLink()"
      >
        Link: {{ connected ? linkState.numPeers : 'OFF' }}
      </button>

      <!-- Serial Connection Button -->
      <button
        v-if="!serialConnected"
        class="bg-neutral-700 text-white border-none px-3 py-1.5 rounded text-xs cursor-pointer hover:bg-neutral-600"
        @click="connectSerial()"
      >
        Connect Serial
      </button>
      <button
        v-else
        class="text-xs px-3 py-1.5 rounded text-green-500 bg-neutral-800 hover:bg-neutral-700 cursor-pointer"
        title="Serial connected"
      >
        Serial: OK
      </button>
    </div>

    <!-- Exit Performance Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showExitConfirm"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        @click.self="showExitConfirm = false"
      >
        <div class="bg-neutral-800 rounded-lg p-6 max-w-md">
          <h3 class="text-lg font-bold text-white mb-2">Exit Performance Mode?</h3>
          <p class="text-neutral-400 mb-4">This will stop beat-sync with Ableton Link. Preset edits will go live immediately.</p>
          <div class="flex gap-3 justify-end">
            <button
              class="px-4 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600"
              @click="showExitConfirm = false"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500"
              @click="confirmExitPerformance"
            >
              Exit Performance
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
