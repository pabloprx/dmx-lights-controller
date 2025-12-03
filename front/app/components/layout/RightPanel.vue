<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor, createDefaultValues } from '~/types/dmx'

const store = useDMXStore()

const presetsExpanded = ref(true)
const scenesExpanded = ref(true)

// Get preset categories
const colorPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'color')
)
const strobePresets = computed(() =>
  store.presets.value.filter(p => p.category === 'strobe')
)
const dimmerPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'dimmer')
)
const customPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'custom')
)

// Add preset dialog
const showAddPreset = ref(false)
const newPresetName = ref('')
const newPresetValues = ref(createDefaultValues())

function handleAddPreset() {
  if (!newPresetName.value.trim()) return

  store.addPreset({
    name: newPresetName.value.trim(),
    profileId: 'pinspot-rgbw-5ch',
    values: { ...newPresetValues.value },
    isBuiltIn: false,
    category: 'custom',
  })

  newPresetName.value = ''
  newPresetValues.value = createDefaultValues()
  showAddPreset.value = false
}

// Master dimmer for quick adjustments
const masterDimmer = ref(100)

function getPresetStyle(preset: typeof store.presets.value[0]) {
  const color = getPreviewColor(preset.values)
  return {
    backgroundColor: color,
  }
}
</script>

<template>
  <div class="right-panel">
    <!-- Presets Section -->
    <section class="panel-section presets-section">
      <button
        class="section-header"
        @click="presetsExpanded = !presetsExpanded"
      >
        <span class="section-title">Presets</span>
        <span class="section-count">{{ store.presets.value.length }}</span>
        <span class="chevron">{{ presetsExpanded ? '▼' : '▶' }}</span>
      </button>

      <div v-if="presetsExpanded" class="section-content">
        <!-- Master Dimmer -->
        <div class="dimmer-control">
          <label>Master</label>
          <input
            v-model.number="masterDimmer"
            type="range"
            min="0"
            max="100"
            class="dimmer-slider"
          >
          <span class="dimmer-value">{{ masterDimmer }}%</span>
        </div>

        <!-- Color Grid -->
        <div class="preset-group">
          <span class="preset-group-label">Colors</span>
          <div class="preset-grid">
            <button
              v-for="preset in colorPresets"
              :key="preset.id"
              class="preset-button"
              :class="{ selected: store.selectedPresetId.value === preset.id }"
              :style="getPresetStyle(preset)"
              :title="preset.name"
              @click="store.selectPreset(preset.id)"
            >
              <span class="preset-label">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Strobe Buttons -->
        <div class="preset-group">
          <span class="preset-group-label">Strobe</span>
          <div class="preset-row">
            <button
              v-for="preset in strobePresets"
              :key="preset.id"
              class="preset-button strobe-button"
              :class="{ selected: store.selectedPresetId.value === preset.id }"
              @click="store.selectPreset(preset.id)"
            >
              {{ preset.name.replace('Strobe ', '') }}
            </button>
          </div>
        </div>

        <!-- Dimmer Presets -->
        <div class="preset-group">
          <span class="preset-group-label">Dimmer</span>
          <div class="preset-row">
            <button
              v-for="preset in dimmerPresets"
              :key="preset.id"
              class="preset-button dimmer-button"
              :class="{ selected: store.selectedPresetId.value === preset.id }"
              @click="store.selectPreset(preset.id)"
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <!-- Custom Presets -->
        <div v-if="customPresets.length > 0" class="preset-group">
          <span class="preset-group-label">Custom</span>
          <div class="preset-grid">
            <button
              v-for="preset in customPresets"
              :key="preset.id"
              class="preset-button"
              :class="{ selected: store.selectedPresetId.value === preset.id }"
              :style="getPresetStyle(preset)"
              :title="preset.name"
              @click="store.selectPreset(preset.id)"
            >
              <span class="preset-label">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <button
          class="add-button"
          @click="showAddPreset = true"
        >
          + Add Custom Preset
        </button>
      </div>
    </section>

    <!-- Scenes Section -->
    <section class="panel-section">
      <button
        class="section-header"
        @click="scenesExpanded = !scenesExpanded"
      >
        <span class="section-title">Scenes</span>
        <span class="section-count">{{ store.scenes.value.length }}</span>
        <span class="chevron">{{ scenesExpanded ? '▼' : '▶' }}</span>
      </button>

      <div v-if="scenesExpanded" class="section-content">
        <div
          v-for="scene in store.scenes.value"
          :key="scene.id"
          class="list-item"
          :class="{ selected: store.selectedSceneId.value === scene.id }"
          @click="store.selectScene(scene.id)"
        >
          <span class="item-name">{{ scene.name }}</span>
          <span class="item-count">{{ scene.assignments.length }} assignments</span>
        </div>

        <div v-if="store.scenes.value.length === 0" class="empty-state">
          No scenes yet
        </div>

        <button class="add-button">
          + Add Scene
        </button>
      </div>
    </section>

    <!-- Add Preset Dialog -->
    <Teleport to="body">
      <div v-if="showAddPreset" class="dialog-overlay" @click.self="showAddPreset = false">
        <div class="dialog">
          <h3 class="dialog-title">Add Custom Preset</h3>

          <div class="form-group">
            <label>Name</label>
            <input
              v-model="newPresetName"
              type="text"
              placeholder="e.g. My Color"
              class="form-input"
            >
          </div>

          <div class="form-group">
            <label>Dimmer</label>
            <input
              v-model.number="newPresetValues.dimmer"
              type="range"
              min="0"
              max="255"
              class="form-slider"
            >
            <span class="slider-value">{{ newPresetValues.dimmer }}</span>
          </div>

          <div class="color-sliders">
            <div class="form-group color-group">
              <label>Red</label>
              <input
                v-model.number="newPresetValues.red"
                type="range"
                min="0"
                max="255"
                class="form-slider red"
              >
            </div>
            <div class="form-group color-group">
              <label>Green</label>
              <input
                v-model.number="newPresetValues.green"
                type="range"
                min="0"
                max="255"
                class="form-slider green"
              >
            </div>
            <div class="form-group color-group">
              <label>Blue</label>
              <input
                v-model.number="newPresetValues.blue"
                type="range"
                min="0"
                max="255"
                class="form-slider blue"
              >
            </div>
            <div class="form-group color-group">
              <label>White</label>
              <input
                v-model.number="newPresetValues.white"
                type="range"
                min="0"
                max="255"
                class="form-slider white"
              >
            </div>
          </div>

          <div class="color-preview" :style="{ backgroundColor: getPreviewColor(newPresetValues) }">
            Preview
          </div>

          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="showAddPreset = false">Cancel</button>
            <button class="btn btn-primary" @click="handleAddPreset">Add</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  border-bottom: 1px solid hsl(var(--border));
}

.presets-section {
  flex: 1;
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: hsl(var(--foreground));
}

.section-header:hover {
  background: hsl(var(--accent));
}

.section-title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  padding: 2px 6px;
  border-radius: 4px;
}

.chevron {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.section-content {
  padding: 8px 12px 12px;
}

/* Dimmer Control */
.dimmer-control {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: hsl(var(--muted));
  border-radius: 4px;
  margin-bottom: 12px;
}

.dimmer-control label {
  font-size: 12px;
  font-weight: 500;
  min-width: 50px;
}

.dimmer-slider {
  flex: 1;
  height: 6px;
  cursor: pointer;
}

.dimmer-value {
  font-size: 12px;
  font-family: monospace;
  min-width: 40px;
  text-align: right;
}

/* Preset Groups */
.preset-group {
  margin-bottom: 12px;
}

.preset-group-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.preset-row {
  display: flex;
  gap: 6px;
}

.preset-button {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.preset-button:hover {
  transform: scale(1.05);
}

.preset-button.selected {
  border-color: hsl(var(--foreground));
  box-shadow: 0 0 0 2px hsl(var(--background));
}

.preset-label {
  font-size: 9px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
}

.strobe-button,
.dimmer-button {
  flex: 1;
  aspect-ratio: auto;
  padding: 8px;
  background: hsl(var(--muted));
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.strobe-button:hover,
.dimmer-button:hover {
  background: hsl(var(--accent));
  transform: none;
}

.strobe-button.selected,
.dimmer-button.selected {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* List Items */
.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.list-item:hover {
  background: hsl(var(--accent));
}

.list-item.selected {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-count {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.list-item.selected .item-count {
  color: hsl(var(--primary-foreground) / 0.7);
}

.empty-state {
  padding: 16px;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.add-button {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  background: none;
  border: 1px dashed hsl(var(--border));
  border-radius: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-button:hover {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

/* Dialog styles */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  max-width: 400px;
}

.dialog-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 6px;
  color: hsl(var(--muted-foreground));
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  color: hsl(var(--foreground));
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.form-slider {
  width: 100%;
  height: 8px;
}

.slider-value {
  font-size: 12px;
  font-family: monospace;
}

.color-sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.color-group {
  margin-bottom: 8px;
}

.form-slider.red::-webkit-slider-thumb {
  background: #ef4444;
}

.form-slider.green::-webkit-slider-thumb {
  background: #22c55e;
}

.form-slider.blue::-webkit-slider-thumb {
  background: #3b82f6;
}

.form-slider.white::-webkit-slider-thumb {
  background: #ffffff;
}

.color-preview {
  height: 48px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-ghost {
  background: none;
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.btn-ghost:hover {
  background: hsl(var(--accent));
}

.btn-primary {
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
