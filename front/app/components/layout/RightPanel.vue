<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor, getProfileById } from '~/types/dmx'
import type { Preset, DeviceProfile } from '~/types/dmx'
import PresetEditorModal from '~/components/presets/PresetEditorModal.vue'

const store = useDMXStore()

// UI State
const allPresetsExpanded = ref(true)

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

// Control type determines which UI to show (sliders vs brush picker)
const controlType = computed(() => selectedProfile.value?.controlType || 'rgbw')

// Get a device ID for the preset modal
const presetModalDeviceId = computed(() => {
  if (store.selectedDevice.value) return store.selectedDevice.value.id
  if (store.selectedGroup.value && store.selectedGroup.value.deviceIds.length > 0) {
    return store.selectedGroup.value.deviceIds[0]
  }
  // Fallback to first RGBW device
  const firstDevice = store.devices.value.find(d => d.profileId === 'pinspot-rgbw-5ch')
  return firstDevice?.id || null
})

// Recent presets (from store.recentPresets array)
const recentPresetObjects = computed(() =>
  store.recentPresets.value
    .map(id => store.getPreset(id))
    .filter((p): p is Preset => p !== null)
)

// All RGBW presets for the "All Presets" section
const allPresets = computed(() =>
  store.presets.value.filter(p => p.profileId === 'pinspot-rgbw-5ch')
)

// Channel values for Laser/Slider control
const laserChannels = ref<number[]>([64, 0, 0, 0, 0, 128, 128, 128, 0, 255])

// Initialize laser channels from profile defaults
watch(selectedProfile, (profile) => {
  if (profile?.controlType === 'sliders') {
    laserChannels.value = profile.channels.map(ch => ch.defaultValue)
  }
}, { immediate: true })

// Add preset modal state
const showAddPreset = ref(false)

// Handle preset save from modal - auto-select as brush
function handlePresetModalSave(presetData: Omit<Preset, 'id'>) {
  const newPreset = store.addPreset(presetData)
  store.setActiveBrush(newPreset.id) // Auto-select new preset as brush
  showAddPreset.value = false
}

// Handle brush selection - set as active brush for painting
function handleBrushClick(presetId: string) {
  store.setActiveBrush(presetId)
}

// Check if preset is selected as active brush
function isBrushSelected(presetId: string): boolean {
  return store.activeBrushId.value === presetId
}

// Send laser channel values to DMX
function sendLaserChannels() {
  if (!store.selectedDevice.value) return

  const dmx = new Array(100).fill(0)
  const start = store.selectedDevice.value.startChannel - 1

  const paddedChannels = [...laserChannels.value]
  while (paddedChannels.length < 16) {
    paddedChannels.push(0)
  }

  for (let i = 0; i < paddedChannels.length && start + i < 100; i++) {
    dmx[start + i] = paddedChannels[i]
  }

  store.sendDMX(dmx)
}

// Watch laser channel changes and send DMX
watch(laserChannels, sendLaserChannels, { deep: true })
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- ═══════════════════════════════════════════════════════════
         BRUSH PICKER - Select presets to paint on clips
         ═══════════════════════════════════════════════════════════ -->
    <section class="flex-1">
      <!-- Section Header -->
      <div class="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50">
        <div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Brush</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ allPresets.length }} presets
        </span>
      </div>

      <div class="px-3 py-3 space-y-4">
        <!-- Current Brush Indicator -->
        <div v-if="store.activeBrush.value" class="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
          <div class="flex items-center gap-2">
            <span
              class="w-6 h-6 rounded-md border border-white/20"
              :style="{ backgroundColor: getPreviewColor(store.activeBrush.value.values) }"
            />
            <div class="flex-1">
              <div class="text-[10px] font-mono text-zinc-500 uppercase">Selected</div>
              <div class="text-sm font-medium text-green-400">{{ store.activeBrush.value.name }}</div>
            </div>
            <button
              class="px-2 py-1 text-[9px] rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white"
              @click="store.setActiveBrush(null)"
            >
              Clear
            </button>
          </div>
        </div>
        <div v-else class="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 text-center">
          <div class="text-zinc-500 text-xs">No brush selected</div>
          <div class="text-zinc-600 text-[10px] mt-1">Click a preset below to select it</div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════
             RECENT PRESETS (quick access)
             ═══════════════════════════════════════════════════════════ -->
        <div v-if="recentPresetObjects.length > 0">
          <span class="block text-[10px] font-mono uppercase tracking-widest text-purple-400/70 mb-2">Recent</span>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="preset in recentPresetObjects"
              :key="preset.id"
              class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                     border-2 flex items-center justify-center"
              :class="isBrushSelected(preset.id)
                ? 'border-white scale-105 z-10'
                : 'border-transparent hover:scale-105'"
              :style="{
                background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                boxShadow: isBrushSelected(preset.id)
                  ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                  : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
              }"
              :title="preset.name"
              @click="handleBrushClick(preset.id)"
            >
              <span class="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
                {{ preset.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════
             ALL PRESETS (collapsible)
             ═══════════════════════════════════════════════════════════ -->
        <div>
          <button
            class="w-full flex items-center gap-2 text-left mb-2"
            @click="allPresetsExpanded = !allPresetsExpanded"
          >
            <span class="text-[10px] font-mono uppercase tracking-widest text-zinc-400">All Presets</span>
            <span class="text-zinc-600 text-[10px] transition-transform duration-200"
                  :class="allPresetsExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
          </button>

          <div v-if="allPresetsExpanded" class="grid grid-cols-4 gap-1.5">
            <button
              v-for="preset in allPresets"
              :key="preset.id"
              class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                     border-2 flex items-center justify-center"
              :class="isBrushSelected(preset.id)
                ? 'border-white scale-105 z-10'
                : 'border-transparent hover:scale-105'"
              :style="{
                background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                boxShadow: isBrushSelected(preset.id)
                  ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                  : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
              }"
              :title="preset.name"
              @click="handleBrushClick(preset.id)"
            >
              <span class="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
                {{ preset.name }}
              </span>
            </button>
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
          + New Preset
        </button>

        <!-- ═══════════════════════════════════════════════════════════
             LASER CHANNEL SLIDERS (only for slider-type devices)
             ═══════════════════════════════════════════════════════════ -->
        <template v-if="controlType === 'sliders' && selectedProfile && store.selectedDevice.value">
          <div class="pt-4 border-t border-zinc-800/50">
            <span class="block text-[10px] font-mono uppercase tracking-widest text-purple-400/70 mb-2">
              {{ selectedProfile.name }} Channels
            </span>
            <div class="space-y-2">
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
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- Add Custom Preset Modal -->
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
