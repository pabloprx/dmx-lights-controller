<script setup lang="ts">
import type { AudioBand } from '~/composables/useAudioReactive'

const { state: linkState, connected, connect: connectLink, disconnect: disconnectLink } = useAbletonLink()
const {
  isConnected: serialConnected,
  connect: connectSerial,
  audioLevels,
  audioConfig,
  sendConfigValue,
  syncConfigToArduino,
  resetConfig,
  DEFAULT_CONFIG,
} = useUnifiedSerial()
import type { AudioConfig } from '~/composables/useUnifiedSerial'
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
const {
  isPlaying, play, stop, audioReactive,
  masterDimmer, setMasterDimmer,
  dimmerChannels, addDimmerChannel, removeDimmerChannel, clearDimmerChannels
} = useSetPlayer()
import type { DimmerChannelConfig } from '~/composables/useSetPlayer'

// Confirmation for exiting performance mode
const showExitConfirm = ref(false)

// Audio config modal
const showAudioConfig = ref(false)
const localConfig = ref<AudioConfig>({ ...DEFAULT_CONFIG })

function openAudioConfig() {
  localConfig.value = { ...audioConfig.value }
  showAudioConfig.value = true
}

function applyAudioConfig() {
  // Send all changed values to Arduino
  for (const key of Object.keys(localConfig.value) as (keyof AudioConfig)[]) {
    if (localConfig.value[key] !== audioConfig.value[key]) {
      sendConfigValue(key, localConfig.value[key])
    }
  }
  showAudioConfig.value = false
}

function handleResetConfig() {
  localConfig.value = { ...DEFAULT_CONFIG }
  resetConfig()
  showAudioConfig.value = false
}

// ═══════════════════════════════════════════════════════════════
// DIMMER CONFIG MODAL
// ═══════════════════════════════════════════════════════════════
const showDimmerConfig = ref(false)
const newDimmerChannel = ref(1)
const newDimmerMin = ref(0)
const newDimmerMax = ref(134)

function openDimmerConfig() {
  showDimmerConfig.value = true
}

function addNewDimmerChannel() {
  if (newDimmerChannel.value < 1 || newDimmerChannel.value > 100) return
  addDimmerChannel({
    channel: newDimmerChannel.value,
    min: newDimmerMin.value,
    max: newDimmerMax.value
  })
  // Reset for next entry
  newDimmerChannel.value = 1
  newDimmerMin.value = 0
  newDimmerMax.value = 134
}

function handleRemoveDimmerChannel(channel: number) {
  removeDimmerChannel(channel)
}

// Cycle through audio bands
const bands: AudioBand[] = ['bass', 'mid', 'high']
function cycleBand() {
  const currentIndex = bands.indexOf(audioReactive.band.value)
  const nextIndex = (currentIndex + 1) % bands.length
  audioReactive.setBand(bands[nextIndex])
}

// Sensitivity presets
const sensitivityPresets = [
  { label: 'Low', value: 50 },
  { label: 'Med', value: 100 },
  { label: 'High', value: 175 },
]

const currentSensitivityLabel = computed(() => {
  const preset = sensitivityPresets.find(p => p.value === audioReactive.sensitivity.value)
  return preset?.label || 'Med'
})

function cycleSensitivity() {
  const currentIdx = sensitivityPresets.findIndex(p => p.value === audioReactive.sensitivity.value)
  const nextIdx = (currentIdx + 1) % sensitivityPresets.length
  audioReactive.setSensitivity(sensitivityPresets[nextIdx].value)
}

// Unified playback toggle - controls both player and internal tempo
function togglePlayback() {
  if (isPlaying.value) {
    stop()
    // Also stop internal tempo in testing mode
    if (isTestingMode.value && internalPlaying.value) {
      toggleInternalPlayback()
    }
  } else {
    play()
    // Also start internal tempo in testing mode
    if (isTestingMode.value && !internalPlaying.value) {
      toggleInternalPlayback()
    }
  }
}

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
          :class="isPlaying ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'"
          @click="togglePlayback"
          title="Play/Stop set playback"
        >
          {{ isPlaying ? '⏸' : '▶' }}
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

    <!-- Beat Indicator (syncs with Link when connected, otherwise internal) -->
    <div class="beat-indicator group relative">
      <div class="flex items-center gap-2">
        <div
          v-for="i in 4"
          :key="i"
          class="w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors"
          :class="
            connected
              ? (linkState.beatInBar === i ? 'bg-red-600 text-white shadow-[0_0_12px_#dc2626]' : 'bg-neutral-800 text-neutral-600')
              : ((internalBeat % 4) + 1 === i ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-600')
          "
        >
          {{ i }}
        </div>
      </div>
      <!-- Link Debug Tooltip (on hover when connected) -->
      <div
        v-if="connected"
        class="link-debug-tooltip"
      >
        <div class="text-[10px] font-bold text-green-400 mb-1">LINK DEBUG</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] font-mono">
          <span class="text-zinc-500">tempo:</span>
          <span class="text-white">{{ linkState.tempo.toFixed(2) }}</span>
          <span class="text-zinc-500">beat:</span>
          <span class="text-white">{{ linkState.beat.toFixed(2) }}</span>
          <span class="text-zinc-500">beatInBar:</span>
          <span class="text-white">{{ linkState.beatInBar }}</span>
          <span class="text-zinc-500">barNumber:</span>
          <span class="text-amber-400">{{ linkState.barNumber }}</span>
          <span class="text-zinc-500">phase:</span>
          <span class="text-white">{{ linkState.phase.toFixed(3) }}</span>
          <span class="text-zinc-500">quantum:</span>
          <span class="text-white">{{ linkState.quantum }}</span>
          <span class="text-zinc-500">peers:</span>
          <span class="text-white">{{ linkState.numPeers }}</span>
          <span class="text-zinc-500">playing:</span>
          <span :class="linkState.isPlaying ? 'text-green-400' : 'text-red-400'">{{ linkState.isPlaying }}</span>
        </div>
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
        :title="serialConnected ? 'Serial connected' : 'Not connected'"
      />
      <!-- Audio Config Button -->
      <button
        v-if="serialConnected"
        class="ml-1 w-5 h-5 flex items-center justify-center rounded text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        title="Audio thresholds config"
        @click="openAudioConfig"
      >
        ⚙
      </button>
    </div>

    <!-- Audio Reactive Toggle -->
    <div class="flex items-center gap-1">
      <button
        class="px-2 py-1 rounded text-xs font-bold uppercase transition-all"
        :class="audioReactive.enabled.value
          ? 'bg-purple-600 text-white shadow-[0_0_8px_#9333ea]'
          : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'"
        title="Audio reactive mode - modulates dimmer with audio"
        @click="audioReactive.toggle"
      >
        🎤
      </button>
      <button
        v-if="audioReactive.enabled.value"
        class="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all"
        :class="{
          'bg-red-600 text-white': audioReactive.band.value === 'bass',
          'bg-green-600 text-white': audioReactive.band.value === 'mid',
          'bg-blue-600 text-white': audioReactive.band.value === 'high',
        }"
        title="Click to cycle: Bass / Mid / High"
        @click="cycleBand"
      >
        {{ audioReactive.band.value.toUpperCase() }}
      </button>
      <button
        v-if="audioReactive.enabled.value"
        class="px-2 py-1 rounded text-[10px] font-bold uppercase transition-all bg-amber-600 text-white hover:bg-amber-500"
        :title="`Sensitivity: ${currentSensitivityLabel} - Click to cycle`"
        @click="cycleSensitivity"
      >
        {{ currentSensitivityLabel }}
      </button>
    </div>

    <!-- Master Dimmer -->
    <div class="master-dimmer">
      <button
        class="text-[10px] text-zinc-500 uppercase font-semibold hover:text-amber-400 transition-colors"
        title="Configure dimmer channels"
        @click="openDimmerConfig"
      >
        Dim
        <span v-if="dimmerChannels.length > 0" class="text-amber-400">({{ dimmerChannels.length }})</span>
      </button>
      <input
        type="range"
        :value="masterDimmer"
        min="0"
        max="100"
        class="dimmer-slider"
        :disabled="dimmerChannels.length === 0"
        :title="dimmerChannels.length === 0 ? 'Click Dim to configure channels' : ''"
        @input="(e) => setMasterDimmer(Number((e.target as HTMLInputElement).value))"
      />
      <span
        class="text-xs font-mono w-8 text-right"
        :class="masterDimmer < 100 && dimmerChannels.length > 0 ? 'text-amber-400' : 'text-zinc-500'"
      >{{ masterDimmer }}%</span>
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

      <!-- Audio Config Modal -->
      <div
        v-if="showAudioConfig"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        @click.self="showAudioConfig = false"
      >
        <div class="bg-neutral-800 rounded-lg p-6 w-[420px] max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-white mb-4">Audio Thresholds Config</h3>
          <p class="text-neutral-500 text-xs mb-4">Adjust FFT mapping thresholds. Changes are sent to Arduino in real-time.</p>

          <!-- Bass Section -->
          <div class="config-section">
            <div class="config-section-title text-red-400">Bass</div>
            <div class="config-row">
              <label>Silence</label>
              <input
                v-model.number="localConfig.bassSilence"
                type="range"
                min="0"
                max="100"
                class="config-slider"
              >
              <span class="config-value">{{ localConfig.bassSilence }}</span>
            </div>
            <div class="config-row">
              <label>Max</label>
              <input
                v-model.number="localConfig.bassMax"
                type="range"
                min="50000"
                max="500000"
                step="10000"
                class="config-slider"
              >
              <span class="config-value">{{ (localConfig.bassMax / 1000).toFixed(0) }}k</span>
            </div>
          </div>

          <!-- Mid Section -->
          <div class="config-section">
            <div class="config-section-title text-green-400">Mid</div>
            <div class="config-row">
              <label>Silence</label>
              <input
                v-model.number="localConfig.midSilence"
                type="range"
                min="0"
                max="100"
                class="config-slider"
              >
              <span class="config-value">{{ localConfig.midSilence }}</span>
            </div>
            <div class="config-row">
              <label>Max</label>
              <input
                v-model.number="localConfig.midMax"
                type="range"
                min="50000"
                max="500000"
                step="10000"
                class="config-slider"
              >
              <span class="config-value">{{ (localConfig.midMax / 1000).toFixed(0) }}k</span>
            </div>
          </div>

          <!-- High Section -->
          <div class="config-section">
            <div class="config-section-title text-blue-400">High</div>
            <div class="config-row">
              <label>Silence</label>
              <input
                v-model.number="localConfig.highSilence"
                type="range"
                min="0"
                max="100"
                class="config-slider"
              >
              <span class="config-value">{{ localConfig.highSilence }}</span>
            </div>
            <div class="config-row">
              <label>Max</label>
              <input
                v-model.number="localConfig.highMax"
                type="range"
                min="50000"
                max="500000"
                step="10000"
                class="config-slider"
              >
              <span class="config-value">{{ (localConfig.highMax / 1000).toFixed(0) }}k</span>
            </div>
          </div>

          <!-- Noise Floor -->
          <div class="config-section">
            <div class="config-section-title text-amber-400">General</div>
            <div class="config-row">
              <label>Noise Floor</label>
              <input
                v-model.number="localConfig.noiseFloor"
                type="range"
                min="0"
                max="30"
                class="config-slider"
              >
              <span class="config-value">{{ localConfig.noiseFloor }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 mt-6 justify-between">
            <button
              class="px-3 py-2 rounded bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-white text-sm"
              @click="handleResetConfig"
            >
              Reset Defaults
            </button>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600"
                @click="showAudioConfig = false"
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500"
                @click="applyAudioConfig"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Dimmer Config Modal -->
    <Teleport to="body">
      <div
        v-if="showDimmerConfig"
        class="config-overlay"
        @click.self="showDimmerConfig = false"
      >
        <div class="config-modal" style="max-width: 500px;">
          <div class="config-header">
            <h3>Dimmer Channel Configuration</h3>
            <button class="config-close" @click="showDimmerConfig = false">×</button>
          </div>

          <div class="config-body">
            <p class="text-xs text-zinc-400 mb-4">
              Configure which DMX channels the master dimmer controls and their value ranges.
            </p>

            <!-- Current Channels List -->
            <div v-if="dimmerChannels.length > 0" class="mb-4">
              <div class="text-xs text-zinc-500 uppercase mb-2">Configured Channels</div>
              <div class="space-y-2">
                <div
                  v-for="config in dimmerChannels"
                  :key="config.channel"
                  class="flex items-center gap-3 p-2 bg-zinc-800 rounded"
                >
                  <span class="text-sm font-mono text-amber-400 w-16">CH {{ config.channel }}</span>
                  <span class="text-xs text-zinc-400">Range:</span>
                  <span class="text-sm font-mono">{{ config.min }} - {{ config.max }}</span>
                  <button
                    class="ml-auto text-red-400 hover:text-red-300 text-sm px-2"
                    @click="handleRemoveDimmerChannel(config.channel)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <!-- Add New Channel -->
            <div class="border border-zinc-700 rounded p-3">
              <div class="text-xs text-zinc-500 uppercase mb-3">Add Channel</div>
              <div class="flex items-center gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-zinc-500">Channel</label>
                  <input
                    v-model.number="newDimmerChannel"
                    type="number"
                    min="1"
                    max="100"
                    class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm font-mono text-center"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-zinc-500">Min</label>
                  <input
                    v-model.number="newDimmerMin"
                    type="number"
                    min="0"
                    max="255"
                    class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm font-mono text-center"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-zinc-500">Max</label>
                  <input
                    v-model.number="newDimmerMax"
                    type="number"
                    min="0"
                    max="255"
                    class="w-16 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm font-mono text-center"
                  />
                </div>
                <button
                  class="mt-4 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                  @click="addNewDimmerChannel"
                >
                  Add
                </button>
              </div>
              <p class="text-[10px] text-zinc-500 mt-2">
                Tip: PinSpot dimmer range is 0-134. Use CH 1 for PinSpot 1, CH 9 for PinSpot 2, etc.
              </p>
            </div>
          </div>

          <div class="config-footer">
            <button
              v-if="dimmerChannels.length > 0"
              class="px-3 py-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm"
              @click="clearDimmerChannels"
            >
              Clear All
            </button>
            <div class="flex-1" />
            <button
              class="px-4 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600"
              @click="showDimmerConfig = false"
            >
              Done
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

/* Link debug tooltip */
.beat-indicator {
  position: relative;
}

.link-debug-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 8px 12px;
  background: #1a1b21;
  border: 1px solid #383944;
  border-radius: 6px;
  z-index: 50;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.beat-indicator:hover .link-debug-tooltip {
  opacity: 1;
}

/* Audio Config Modal */
.config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #1a1b21;
  border-radius: 8px;
  border: 1px solid #383944;
}

.config-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-row label {
  font-size: 11px;
  color: #888;
  width: 60px;
  flex-shrink: 0;
}

.config-slider {
  flex: 1;
  height: 6px;
  cursor: pointer;
  accent-color: #22c55e;
}

.config-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: #aaa;
  min-width: 40px;
  text-align: right;
}

/* Master Dimmer */
.master-dimmer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #22232b;
  border: 1px solid #383944;
  border-radius: 6px;
}

.dimmer-slider {
  width: 80px;
  height: 6px;
  cursor: pointer;
  accent-color: #f59e0b;
}

.dimmer-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Dimmer Config Modal */
.config-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.config-modal {
  background: #27272a;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #383944;
}

.config-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.config-close {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.config-close:hover {
  color: white;
}

.config-body {
  padding: 20px;
  overflow-y: auto;
}

.config-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #383944;
}
</style>
