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
    :class="isPerformanceMode ? 'border-red-500' : 'border-neutral-6'"
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

    <!-- Audio Levels - Always visible -->
    <div class="audio-levels">
      <!-- Bass -->
      <div class="audio-bar">
        <span class="audio-label text-red-400">B</span>
        <div class="audio-track">
          <div
            class="audio-fill bg-red-500"
            :class="{ 'audio-glow-red': audioLevels.bass > 70 }"
            :style="{ width: `${audioLevels.bass}%` }"
          />
        </div>
      </div>
      <!-- Mid -->
      <div class="audio-bar">
        <span class="audio-label text-green-400">M</span>
        <div class="audio-track">
          <div
            class="audio-fill bg-green-500"
            :class="{ 'audio-glow-green': audioLevels.mid > 70 }"
            :style="{ width: `${audioLevels.mid}%` }"
          />
        </div>
      </div>
      <!-- High -->
      <div class="audio-bar">
        <span class="audio-label text-blue-400">H</span>
        <div class="audio-track">
          <div
            class="audio-fill bg-blue-500"
            :class="{ 'audio-glow-blue': audioLevels.high > 70 }"
            :style="{ width: `${audioLevels.high}%` }"
          />
        </div>
      </div>
      <!-- Connection indicator -->
      <div
        class="w-1.5 h-1.5 rounded-full ml-1"
        :class="serialConnected ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-zinc-600'"
        :title="serialConnected ? 'Audio connected' : 'No audio input'"
      />
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

<style scoped>
/* Audio Levels - Neon Studio Style */
.audio-levels {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #22232b;
  border: 1px solid #383944;
  border-radius: 6px;
}

.audio-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.audio-label {
  font-size: 10px;
  font-weight: 600;
  width: 12px;
  font-family: 'JetBrains Mono', monospace;
}

.audio-track {
  width: 48px;
  height: 8px;
  background: #1a1b21;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #383944;
}

.audio-fill {
  height: 100%;
  transition: width 50ms ease-out;
  border-radius: 3px;
}

/* Glow effects when level > 70% */
.audio-glow-red {
  box-shadow: 0 0 8px #ef4444, 0 0 12px #ef444480;
}

.audio-glow-green {
  box-shadow: 0 0 8px #22c55e, 0 0 12px #22c55e80;
}

.audio-glow-blue {
  box-shadow: 0 0 8px #3b82f6, 0 0 12px #3b82f680;
}
</style>
