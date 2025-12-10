<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor } from '~/types/dmx'
import type { Preset } from '~/types/dmx'

const emit = defineEmits<{
  openPresetEditor: []
}>()

const store = useDMXStore()

// Quick colors (RGB values for instant presets)
const quickColors = [
  { id: 'qc-red', name: 'RED', r: 255, g: 0, b: 0 },
  { id: 'qc-green', name: 'GRN', r: 0, g: 255, b: 0 },
  { id: 'qc-blue', name: 'BLU', r: 0, g: 0, b: 255 },
  { id: 'qc-cyan', name: 'CYN', r: 0, g: 255, b: 255 },
  { id: 'qc-magenta', name: 'MAG', r: 255, g: 0, b: 255 },
  { id: 'qc-yellow', name: 'YEL', r: 255, g: 255, b: 0 },
  { id: 'qc-orange', name: 'ORG', r: 255, g: 128, b: 0 },
  { id: 'qc-white', name: 'WHT', r: 255, g: 255, b: 255 },
]

// Dimmer levels
const dimmerLevels = [
  { id: 'dim-25', name: '25%', value: 64 },
  { id: 'dim-50', name: '50%', value: 128 },
  { id: 'dim-75', name: '75%', value: 192 },
  { id: 'dim-full', name: 'FULL', value: 255 },
]

// Strobe speeds
const strobeSpeeds = [
  { id: 'strobe-slow', name: 'SLO', speed: 'slow' as const },
  { id: 'strobe-med', name: 'MED', speed: 'medium' as const },
  { id: 'strobe-fast', name: 'FST', speed: 'fast' as const },
]

// Get active brush color for preview
const activeBrushColor = computed(() => {
  if (!store.activeBrush.value) return null
  if (store.activeBrush.value.values) {
    return getPreviewColor(store.activeBrush.value.values)
  }
  return '#666'
})

// Get RGBW presets for pinspot profile
const rgbwPresets = computed(() =>
  store.presets.value.filter(p => p.profileId === 'pinspot-rgbw-5ch')
)

// Custom presets only
const customPresets = computed(() =>
  rgbwPresets.value.filter(p => p.category === 'custom')
)

// Handle quick color click - find or create preset and set as brush
function handleQuickColor(color: typeof quickColors[0]) {
  // Find matching built-in preset
  const preset = store.presets.value.find(p =>
    p.profileId === 'pinspot-rgbw-5ch' &&
    p.values?.red === color.r &&
    p.values?.green === color.g &&
    p.values?.blue === color.b
  )

  if (preset) {
    store.setActiveBrush(preset.id)
  }
}

// Handle dimmer click
function handleDimmer(level: typeof dimmerLevels[0]) {
  const preset = store.presets.value.find(p =>
    p.profileId === 'pinspot-rgbw-5ch' &&
    p.category === 'dimmer' &&
    p.name.includes(level.name.replace('%', ''))
  )
  if (preset) {
    store.setActiveBrush(preset.id)
  }
}

// Handle strobe click
function handleStrobe(strobe: typeof strobeSpeeds[0]) {
  const preset = store.presets.value.find(p =>
    p.profileId === 'pinspot-rgbw-5ch' &&
    p.category === 'strobe' &&
    p.values?.strobeSpeed === strobe.speed
  )
  if (preset) {
    store.setActiveBrush(preset.id)
  }
}

// Handle preset click
function handlePresetClick(preset: Preset) {
  store.setActiveBrush(preset.id)
}

// Check if color is active
function isColorActive(color: typeof quickColors[0]): boolean {
  if (!store.activeBrush.value?.values) return false
  const v = store.activeBrush.value.values
  return v.red === color.r && v.green === color.g && v.blue === color.b
}

// Check if dimmer is active
function isDimmerActive(level: typeof dimmerLevels[0]): boolean {
  return store.activeBrush.value?.category === 'dimmer' &&
    store.activeBrush.value?.name?.includes(level.name.replace('%', ''))
}

// Check if strobe is active
function isStrobeActive(strobe: typeof strobeSpeeds[0]): boolean {
  return store.activeBrush.value?.values?.strobeSpeed === strobe.speed &&
    store.activeBrush.value?.values?.strobe === true
}
</script>

<template>
  <div class="palette-bar">
    <!-- Active Brush Display -->
    <div class="brush-display">
      <div
        class="brush-preview"
        :style="{
          backgroundColor: activeBrushColor || '#1a1a1a',
          boxShadow: activeBrushColor ? `0 0 20px ${activeBrushColor}60, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none'
        }"
      >
        <span v-if="!store.activeBrush.value" class="no-brush">—</span>
      </div>
      <div class="brush-info">
        <span class="brush-label">BRUSH</span>
        <span class="brush-name">{{ store.activeBrush.value?.name || 'None' }}</span>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Quick Colors -->
    <div class="section colors-section">
      <span class="section-label">COLORS</span>
      <div class="color-row">
        <button
          v-for="color in quickColors"
          :key="color.id"
          class="color-pad"
          :class="{ active: isColorActive(color) }"
          :style="{
            '--pad-color': `rgb(${color.r}, ${color.g}, ${color.b})`,
            backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`
          }"
          :title="color.name"
          @click="handleQuickColor(color)"
        >
          <span class="color-label">{{ color.name }}</span>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Dimmer Levels -->
    <div class="section dimmer-section">
      <span class="section-label">DIM</span>
      <div class="button-row">
        <button
          v-for="level in dimmerLevels"
          :key="level.id"
          class="dim-btn"
          :class="{ active: isDimmerActive(level) }"
          @click="handleDimmer(level)"
        >
          {{ level.name }}
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Strobe -->
    <div class="section strobe-section">
      <span class="section-label">STROBE</span>
      <div class="button-row">
        <button
          v-for="strobe in strobeSpeeds"
          :key="strobe.id"
          class="strobe-btn"
          :class="{ active: isStrobeActive(strobe) }"
          @click="handleStrobe(strobe)"
        >
          {{ strobe.name }}
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Tool Mode Toggle -->
    <div class="section tool-section">
      <button
        class="tool-btn paint-btn"
        :class="{ active: store.toolMode.value === 'paint' }"
        title="Paint Mode (P)"
        @click="store.setToolMode('paint')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
        </svg>
      </button>
      <button
        class="tool-btn erase-btn"
        :class="{ active: store.toolMode.value === 'erase' }"
        title="Erase Mode (E)"
        @click="store.setToolMode('erase')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.5 2.7a2 2 0 0 1 2.8 0L21 7.3a2 2 0 0 1 0 2.8L11 20" />
          <path d="M6 11l6 6" />
        </svg>
      </button>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- New Preset Button -->
    <button class="new-btn" title="Create Custom Preset" @click="emit('openPresetEditor')">
      <span class="plus">+</span>
      <span class="new-label">NEW</span>
    </button>

    <!-- Custom Presets (if any) -->
    <template v-if="customPresets.length > 0">
      <div class="divider" />
      <div class="section custom-section">
        <span class="section-label">CUSTOM</span>
        <div class="custom-row">
          <button
            v-for="preset in customPresets.slice(0, 6)"
            :key="preset.id"
            class="custom-pad"
            :class="{ active: store.activeBrushId.value === preset.id }"
            :style="{
              '--pad-color': preset.values ? getPreviewColor(preset.values) : '#666',
              backgroundColor: preset.values ? getPreviewColor(preset.values) : '#666'
            }"
            :title="preset.name"
            @click="handlePresetClick(preset)"
          >
            <span class="custom-label">{{ preset.name.substring(0, 3).toUpperCase() }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.palette-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: linear-gradient(180deg, #1a1b1e 0%, #141518 100%);
  border-bottom: 1px solid #0a0a0c;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.03),
    0 2px 8px rgba(0,0,0,0.4);
  min-height: 56px;
}

/* Active Brush Display */
.brush-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 8px;
}

.brush-preview {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 2px solid #2a2b30;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.no-brush {
  color: #444;
  font-size: 18px;
}

.brush-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brush-label {
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  color: #555;
  letter-spacing: 0.1em;
}

.brush-name {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  color: #22c55e;
  font-weight: 600;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dividers */
.divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(180deg, transparent 0%, #333 50%, transparent 100%);
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-label {
  font-size: 8px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  color: #444;
  letter-spacing: 0.15em;
  text-align: center;
}

/* Color Pads */
.color-row, .custom-row {
  display: flex;
  gap: 4px;
}

.color-pad, .custom-pad {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.color-pad::before, .custom-pad::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
  pointer-events: none;
}

.color-pad:hover, .custom-pad:hover {
  transform: scale(1.1);
  z-index: 1;
}

.color-pad.active, .custom-pad.active {
  border-color: #fff;
  transform: scale(1.15);
  z-index: 2;
  box-shadow:
    0 0 16px var(--pad-color),
    0 0 4px rgba(255,255,255,0.5);
}

.color-label, .custom-label {
  font-size: 7px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-weight: 700;
  color: rgba(0,0,0,0.7);
  text-shadow: 0 1px 1px rgba(255,255,255,0.3);
  letter-spacing: -0.02em;
}

/* Button Rows */
.button-row {
  display: flex;
  gap: 3px;
}

.dim-btn, .strobe-btn {
  padding: 4px 8px;
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-weight: 600;
  background: #1e1f24;
  border: 1px solid #2a2b30;
  border-radius: 4px;
  color: #777;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.03),
    0 1px 2px rgba(0,0,0,0.3);
}

.dim-btn:hover, .strobe-btn:hover {
  background: #252630;
  color: #aaa;
}

.dim-btn.active {
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
  border-color: #22c55e;
  color: #000;
  box-shadow:
    0 0 12px #22c55e50,
    inset 0 1px 0 rgba(255,255,255,0.2);
}

.strobe-btn.active {
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
  border-color: #f59e0b;
  color: #000;
  box-shadow:
    0 0 12px #f59e0b50,
    inset 0 1px 0 rgba(255,255,255,0.2);
  animation: strobe-pulse 0.5s ease infinite alternate;
}

@keyframes strobe-pulse {
  from { opacity: 0.9; }
  to { opacity: 1; }
}

/* Tool Buttons */
.tool-section {
  flex-direction: row;
  gap: 4px;
}

.tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1f24;
  border: 1px solid #2a2b30;
  border-radius: 6px;
  color: #555;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: #252630;
  color: #888;
}

.tool-btn.active {
  color: #22c55e;
  border-color: #22c55e50;
  background: #22c55e10;
  box-shadow: 0 0 12px #22c55e20;
}

.erase-btn.active {
  color: #ef4444;
  border-color: #ef444450;
  background: #ef444410;
  box-shadow: 0 0 12px #ef444420;
}

/* New Button */
.new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(180deg, #2a2b30 0%, #1e1f24 100%);
  border: 1px dashed #3a3b40;
  border-radius: 6px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
}

.new-btn:hover {
  border-color: #22c55e50;
  color: #22c55e;
  background: #22c55e08;
}

.plus {
  font-size: 16px;
  font-weight: 300;
  line-height: 1;
}

.new-label {
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-weight: 600;
  letter-spacing: 0.05em;
}
</style>
