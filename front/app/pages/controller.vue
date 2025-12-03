<script setup lang="ts">
import TransportBar from '~/components/transport/TransportBar.vue'
import AppLayout from '~/components/layout/AppLayout.vue'
import LeftPanel from '~/components/layout/LeftPanel.vue'
import RightPanel from '~/components/layout/RightPanel.vue'
import SetEditor from '~/components/sets/SetEditor.vue'
import { useDMXStore } from '~/composables/useDMXStore'
import { useSetPlayer } from '~/composables/useSetPlayer'
import { getPreviewColor } from '~/types/dmx'

const { isPerformanceMode } = useAppMode()
const store = useDMXStore()
const player = useSetPlayer()

// Two main tabs: Compose and Perform
const activeTab = ref<'compose' | 'perform'>('compose')

// Panel collapse state
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)

// In Perform mode, collapse panels by default
watch(isPerformanceMode, (isPerf) => {
  if (isPerf) {
    leftPanelCollapsed.value = true
  }
})

// Activate a set from the Perform view
function activateSet(setId: string) {
  player.setActiveSet(setId)
  if (!player.isPlaying.value) {
    player.play()
  }
}

// Get clip colors for a set (for preview)
function getSetClipColors(set: typeof store.sets.value[0]) {
  const colors: string[] = []
  for (const clip of set.clips.slice(0, 8)) {
    const preset = store.getPreset(clip.presetId)
    if (preset) {
      colors.push(getPreviewColor(preset.values))
    }
  }
  return colors
}

// Calculate beat progress percentage
const beatProgress = computed(() => {
  const set = store.activeSet.value
  if (!set) return 0
  return ((player.beatInSet.value - 1) / set.length) * 100
})
</script>

<template>
  <div class="controller-page">
    <TransportBar />

    <!-- Tab Bar -->
    <div class="tab-bar">
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'compose', compose: activeTab === 'compose' }"
          @click="activeTab = 'compose'"
        >
          <span class="tab-icon">&#9998;</span>
          Compose
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'perform', perform: activeTab === 'perform' }"
          @click="activeTab = 'perform'"
        >
          <span class="tab-icon">&#9654;</span>
          Perform
        </button>
      </div>

      <!-- Mode indicator -->
      <div v-if="isPerformanceMode" class="mode-indicator">
        <div class="live-dot" />
        <span>LIVE</span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-area">
      <!-- Compose Tab -->
      <AppLayout
        v-if="activeTab === 'compose'"
        v-model:left-panel-collapsed="leftPanelCollapsed"
        v-model:right-panel-collapsed="rightPanelCollapsed"
      >
        <template #left>
          <LeftPanel />
        </template>

        <SetEditor />

        <template #right>
          <RightPanel />
        </template>
      </AppLayout>

      <!-- Perform Tab -->
      <div v-else class="perform-view">
        <div class="perform-content">
          <!-- Now Playing -->
          <div v-if="store.activeSet.value" class="now-playing">
            <div class="now-playing-label">NOW PLAYING</div>
            <div class="now-playing-name">{{ store.activeSet.value.name }}</div>
            <div class="now-playing-beat">
              Beat {{ player.beatInSet.value }} / {{ store.activeSet.value.length }}
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: beatProgress + '%' }" />
            </div>
            <div class="playback-controls">
              <button
                class="control-btn"
                :class="{ playing: player.isPlaying.value }"
                @click="player.isPlaying.value ? player.stop() : player.play()"
              >
                {{ player.isPlaying.value ? '⏹ Stop' : '▶ Play' }}
              </button>
            </div>
          </div>

          <h2 v-else class="no-set-title">Select a Set to Play</h2>

          <!-- Set Grid -->
          <div class="set-grid">
            <button
              v-for="set in store.sets.value"
              :key="set.id"
              class="set-button"
              :class="{ active: store.activeSetId.value === set.id, playing: store.activeSetId.value === set.id && player.isPlaying.value }"
              @click="activateSet(set.id)"
            >
              <div class="set-name">{{ set.name }}</div>
              <div class="set-info">{{ set.length }} beats · {{ set.clips.length }} clips</div>
              <div class="set-colors">
                <span
                  v-for="(color, idx) in getSetClipColors(set)"
                  :key="idx"
                  class="color-dot"
                  :style="{ backgroundColor: color }"
                />
              </div>
              <!-- Beat indicator for active set -->
              <div v-if="store.activeSetId.value === set.id && player.isPlaying.value" class="set-beat-indicator">
                <div class="beat-fill" :style="{ width: beatProgress + '%' }" />
              </div>
            </button>
          </div>

          <!-- Empty state -->
          <div v-if="store.sets.value.length === 0" class="empty-state">
            <p>No Sets created yet</p>
            <p class="hint">Switch to Compose tab to create Sets</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controller-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Tab Bar */
.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.tabs {
  display: flex;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.tab.active.compose {
  color: #22c55e;
  border-bottom-color: #22c55e;
}

.tab.active.perform {
  color: #ef4444;
  border-bottom-color: #ef4444;
}

.tab-icon {
  font-size: 12px;
}

/* Mode Indicator */
.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ef4444;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Main Area */
.main-area {
  flex: 1;
  overflow: hidden;
}

/* Perform View */
.perform-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 32px;
  overflow-y: auto;
}

.perform-content {
  width: 100%;
  max-width: 800px;
}

/* Now Playing Section */
.now-playing {
  text-align: center;
  margin-bottom: 32px;
  padding: 24px;
  background: hsl(var(--card));
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
}

.now-playing-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #22c55e;
  margin-bottom: 8px;
}

.now-playing-name {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.now-playing-beat {
  font-size: 16px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 16px;
  font-family: monospace;
}

.progress-bar {
  height: 8px;
  background: hsl(var(--muted));
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #3b82f6);
  transition: width 0.1s linear;
}

.playback-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.control-btn {
  padding: 12px 32px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.control-btn:hover {
  background: hsl(var(--accent));
}

.control-btn.playing {
  background: #ef4444;
  color: white;
}

.no-set-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24px;
  color: hsl(var(--muted-foreground));
}

/* Set Grid */
.set-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.set-button {
  position: relative;
  padding: 20px;
  background: hsl(var(--card));
  border: 2px solid hsl(var(--border));
  border-radius: 12px;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  overflow: hidden;
}

.set-button:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--accent));
  transform: translateY(-2px);
}

.set-button.active {
  border-color: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

.set-button.playing {
  border-color: #22c55e;
  animation: glow 1.5s infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
  50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4); }
}

.set-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.set-info {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 12px;
}

.set-colors {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.set-beat-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: hsl(var(--muted));
}

.beat-fill {
  height: 100%;
  background: #22c55e;
  transition: width 0.1s linear;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px;
  color: hsl(var(--muted-foreground));
}

.empty-state p {
  margin-bottom: 8px;
}

.empty-state .hint {
  font-size: 14px;
  opacity: 0.7;
}
</style>
