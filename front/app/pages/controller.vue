<script setup lang="ts">
import TransportBar from '~/components/transport/TransportBar.vue'
import AppLayout from '~/components/layout/AppLayout.vue'
import LeftPanel from '~/components/layout/LeftPanel.vue'
import RightPanel from '~/components/layout/RightPanel.vue'
import SetEditor from '~/components/sets/SetEditor.vue'

const { isPerformanceMode } = useAppMode()

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
          <h2>Perform Mode</h2>
          <p class="perform-hint">Large set buttons and playlist queue coming soon...</p>

          <!-- Quick Set Buttons (placeholder) -->
          <div class="set-buttons">
            <button
              v-for="set in 8"
              :key="set"
              class="set-button"
            >
              Set {{ set }}
            </button>
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
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.perform-content {
  text-align: center;
}

.perform-content h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.perform-hint {
  color: hsl(var(--muted-foreground));
  margin-bottom: 32px;
}

.set-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  max-width: 600px;
}

.set-button {
  aspect-ratio: 1;
  background: hsl(var(--card));
  border: 2px solid hsl(var(--border));
  border-radius: 12px;
  color: hsl(var(--foreground));
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.set-button:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--accent));
}
</style>
