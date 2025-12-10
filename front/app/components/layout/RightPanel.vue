<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor, getProfileById } from '~/types/dmx'
import type { Preset, DeviceProfile } from '~/types/dmx'
import PresetEditorModal from '~/components/presets/PresetEditorModal.vue'

const store = useDMXStore()

const presetsExpanded = ref(true)

// Check if we have a device or group selected
const hasSelection = computed(() => store.selectedDevice.value || store.selectedGroup.value)
const isGroupSelected = computed(() => !!store.selectedGroup.value && !store.selectedDevice.value)

// Get selected device's or group's profile
const selectedProfile = computed((): DeviceProfile | null => {
  if (store.selectedDevice.value) {
    return getProfileById(store.selectedDevice.value.profileId) || null
  }
  if (store.selectedGroup.value) {
    return getProfileById(store.selectedGroup.value.profileId) || null
  }
  return null
})

// Get the display name for the selection
const selectionName = computed(() => {
  if (store.selectedDevice.value) return store.selectedDevice.value.name
  if (store.selectedGroup.value) return store.selectedGroup.value.name
  return null
})

// Get a device ID for the preset modal (first device in group if group selected)
const presetModalDeviceId = computed(() => {
  if (store.selectedDevice.value) return store.selectedDevice.value.id
  if (store.selectedGroup.value && store.selectedGroup.value.deviceIds.length > 0) {
    return store.selectedGroup.value.deviceIds[0]
  }
  return null
})

// Control type determines which UI to show
const controlType = computed(() => selectedProfile.value?.controlType || 'rgbw')

// Get preset categories (only for RGBW profiles)
const colorPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'color' && p.profileId === 'pinspot-rgbw-5ch')
)
const strobePresets = computed(() =>
  store.presets.value.filter(p => p.category === 'strobe' && p.profileId === 'pinspot-rgbw-5ch')
)
const dimmerPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'dimmer' && p.profileId === 'pinspot-rgbw-5ch')
)
const customPresets = computed(() =>
  store.presets.value.filter(p => p.category === 'custom' && p.profileId === 'pinspot-rgbw-5ch')
)

// Channel values for Laser control
const laserChannels = ref<number[]>([64, 0, 0, 0, 0, 128, 128, 128, 0, 255])

// Initialize laser channels from profile defaults
watch(selectedProfile, (profile) => {
  if (profile?.controlType === 'sliders') {
    laserChannels.value = profile.channels.map(ch => ch.defaultValue)
  }
}, { immediate: true })

// Add preset modal state
const showAddPreset = ref(false)

// Handle preset save from modal (just adds to library, no clip)
function handlePresetModalSave(presetData: Omit<Preset, 'id'>) {
  store.addPreset(presetData)
  showAddPreset.value = false
}

// Handle color preset click - can combine with strobe/dimmer effect
function handleColorClick(presetId: string) {
  store.selectColorPreset(presetId)
}

// Handle effect preset click (strobe OR dimmer - mutually exclusive)
function handleEffectClick(presetId: string) {
  store.selectEffectPreset(presetId)
}

// Check if color is selected
function isColorSelected(presetId: string): boolean {
  return store.selectedColorPresetId.value === presetId
}

// Check if effect is selected
function isEffectSelected(presetId: string): boolean {
  return store.selectedEffectPresetId.value === presetId
}

// Send laser channel values to DMX
function sendLaserChannels() {
  if (!store.selectedDevice.value) return

  const dmx = new Array(100).fill(0)
  const start = store.selectedDevice.value.startChannel - 1

  // Pad to 16 channels minimum (some fixtures expect this)
  const paddedChannels = [...laserChannels.value]
  while (paddedChannels.length < 16) {
    paddedChannels.push(0)
  }

  console.log('[RightPanel] sendLaserChannels - device:', store.selectedDevice.value.name, 'ch', store.selectedDevice.value.startChannel, 'values:', paddedChannels)

  for (let i = 0; i < paddedChannels.length && start + i < 100; i++) {
    dmx[start + i] = paddedChannels[i]
  }

  console.log('[RightPanel] Sending DMX channels', start + 1, 'to', start + paddedChannels.length, ':', dmx.slice(start, start + paddedChannels.length))
  store.sendDMX(dmx)
}

// Watch laser channel changes and send DMX
watch(laserChannels, sendLaserChannels, { deep: true })
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- ═══════════════════════════════════════════════════════════
         CONTROLS SECTION - Dynamic based on selected device profile
         ═══════════════════════════════════════════════════════════ -->
    <section class="flex-1 border-b border-zinc-800/50">
      <!-- Section Header -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="presetsExpanded = !presetsExpanded"
      >
        <div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">
          {{ controlType === 'sliders' ? 'Channels' : 'Presets' }}
        </span>
        <span
          v-if="selectedProfile"
          class="px-1.5 py-0.5 text-[9px] font-bold rounded ml-1"
          :class="controlType === 'sliders'
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-cyan-500/20 text-cyan-400'"
        >
          {{ selectedProfile.name }}
        </span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ controlType === 'sliders' ? selectedProfile?.channelCount || 0 : store.presets.value.filter(p => p.profileId === 'pinspot-rgbw-5ch').length }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="presetsExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <div v-if="presetsExpanded" class="px-3 py-3 space-y-4">
        <!-- No device/group selected state -->
        <div v-if="!hasSelection" class="py-8 text-center">
          <div class="text-zinc-500 text-xs mb-2">No device selected</div>
          <div class="text-zinc-600 text-[10px]">Select a device or group from the left panel</div>
        </div>

        <!-- Group indicator -->
        <div v-else-if="isGroupSelected" class="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-2">
          <span
            class="w-3 h-3 rounded-sm"
            :style="{ backgroundColor: store.selectedGroup.value?.color }"
          />
          <span class="text-xs text-purple-400">
            Group: <strong>{{ store.selectedGroup.value?.name }}</strong>
            <span class="text-purple-400/60 ml-1">({{ store.selectedGroup.value?.deviceIds.length }} devices)</span>
          </span>
        </div>

        <!-- ═══════════════════════════════════════════════════════════
             LASER CHANNEL SLIDERS (controlType: 'sliders')
             ═══════════════════════════════════════════════════════════ -->
        <template v-if="hasSelection && controlType === 'sliders' && selectedProfile">
          <div
            v-for="(channel, idx) in selectedProfile.channels"
            :key="channel.offset"
            class="channel-row"
          >
            <div class="channel-info">
              <span class="channel-name">{{ channel.name }}</span>
              <span v-if="channel.description" class="channel-desc">{{ channel.description }}</span>
            </div>
            <div class="channel-control">
              <input
                v-model.number="laserChannels[idx]"
                type="range"
                :min="channel.min"
                :max="channel.max"
                class="channel-slider"
              >
              <span class="channel-value">{{ laserChannels[idx] }}</span>
            </div>
          </div>
        </template>

        <!-- ═══════════════════════════════════════════════════════════
             RGBW COLOR PRESETS (controlType: 'rgbw')
             ═══════════════════════════════════════════════════════════ -->
        <template v-if="hasSelection && controlType === 'rgbw'">
          <!-- Color Grid - GLOWING PADS -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-green-400/70 mb-2">Colors</span>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="preset in colorPresets"
                :key="preset.id"
                class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                       border-2 flex items-center justify-center"
                :class="isColorSelected(preset.id)
                  ? 'border-white scale-105 z-10'
                  : 'border-transparent hover:scale-105'"
                :style="{
                  background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                  boxShadow: isColorSelected(preset.id)
                    ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                    : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
                }"
                :title="preset.name"
                @click="handleColorClick(preset.id)"
              >
                <span class="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
                  {{ preset.name }}
                </span>
              </button>
            </div>
          </div>

          <!-- Strobe Buttons (effect - mutually exclusive with dimmer) -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-amber-400/70 mb-2">Strobe</span>
            <div class="flex gap-1.5">
              <button
                v-for="preset in strobePresets"
                :key="preset.id"
                class="flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200
                       border border-zinc-800"
                :class="isEffectSelected(preset.id)
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_#f59e0b30]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'"
                @click="handleEffectClick(preset.id)"
              >
                {{ preset.name.replace('Strobe ', '') }}
              </button>
            </div>
          </div>

          <!-- Dimmer Presets (effect - mutually exclusive with strobe) -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">Dimmer</span>
            <div class="flex gap-1.5">
              <button
                v-for="preset in dimmerPresets"
                :key="preset.id"
                class="flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200
                       border border-zinc-800"
                :class="isEffectSelected(preset.id)
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_15px_#06b6d430]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'"
                @click="handleEffectClick(preset.id)"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>

          <!-- Recent/Custom Presets -->
          <div v-if="customPresets.length > 0">
            <span class="block text-[10px] font-mono uppercase tracking-widest text-purple-400/70 mb-2">Recent</span>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="preset in customPresets"
                :key="preset.id"
                class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                       border-2 flex items-center justify-center"
                :class="isColorSelected(preset.id)
                  ? 'border-white scale-105 z-10'
                  : 'border-transparent hover:scale-105'"
                :style="{
                  background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                  boxShadow: isColorSelected(preset.id)
                    ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                    : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
                }"
                :title="preset.name"
                @click="handleColorClick(preset.id)"
              >
                <span class="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
                  {{ preset.name }}
                </span>
              </button>
            </div>
          </div>

          <!-- Combined selection indicator -->
          <div v-if="store.selectedColorPresetId.value || store.selectedEffectPresetId.value" class="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono text-zinc-500 uppercase">Active</span>
              <button
                class="px-2 py-0.5 text-[9px] rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white"
                @click="store.selectColorPreset(null); store.selectEffectPreset(null)"
              >
                Clear All
              </button>
            </div>
            <div class="flex flex-wrap gap-1">
              <span v-if="store.selectedColorPresetId.value" class="px-2 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 border border-green-500/30">
                {{ store.getPreset(store.selectedColorPresetId.value)?.name }}
              </span>
              <span v-if="store.selectedEffectPresetId.value" class="px-2 py-0.5 text-[10px] rounded"
                :class="store.getPreset(store.selectedEffectPresetId.value)?.category === 'strobe'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'"
              >
                {{ store.getPreset(store.selectedEffectPresetId.value)?.name }}
              </span>
            </div>
          </div>

          <!-- Add Custom Preset Button -->
          <button
            class="w-full py-2.5 rounded-lg border border-dashed border-zinc-600
                   text-zinc-400 text-xs font-medium
                   hover:border-green-500/50 hover:text-green-400
                   hover:bg-green-500/5 hover:shadow-[0_0_20px_#22c55e08]
                   transition-all duration-300"
            @click="showAddPreset = true"
          >
            + Add Custom Preset
          </button>
        </template>
      </div>
    </section>

    <!-- Add Custom Preset Modal (reuses PresetEditorModal) -->
    <PresetEditorModal
      v-if="presetModalDeviceId"
      :open="showAddPreset"
      :device-id="presetModalDeviceId"
      :preset="null"
      @update:open="showAddPreset = $event"
      @save="handlePresetModalSave"
      @discard="showAddPreset = false"
    />
  </div>
</template>

<style scoped>
/* Channel sliders for Laser */
.channel-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #22232b;
  border: 1px solid #383944;
  border-radius: 6px;
}

.channel-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.channel-name {
  font-size: 11px;
  font-weight: 500;
  color: #f0f0f5;
}

.channel-desc {
  font-size: 9px;
  color: #8888a0;
  font-family: 'JetBrains Mono', monospace;
}

.channel-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-slider {
  flex: 1;
  height: 6px;
  cursor: pointer;
  accent-color: #8b5cf6;
}

.channel-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  min-width: 28px;
  text-align: right;
  color: #8b5cf6;
}

</style>
