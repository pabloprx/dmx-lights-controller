<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor, createDefaultValues, getProfileById } from '~/types/dmx'
import type { DeviceProfile } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const store = useDMXStore()

const presetsExpanded = ref(true)

// Get selected device's profile
const selectedProfile = computed((): DeviceProfile | null => {
  if (!store.selectedDevice.value) return null
  return getProfileById(store.selectedDevice.value.profileId) || null
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

// Add preset dialog (only for RGBW)
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

// Handle preset click - select and send DMX
function handlePresetClick(presetId: string) {
  store.selectPreset(presetId)

  // Send DMX to selected device
  if (store.selectedDevice.value) {
    store.applyPresetToDevice(presetId, store.selectedDevice.value.id)
  }
}

// Send laser channel values to DMX
function sendLaserChannels() {
  if (!store.selectedDevice.value) return

  const dmx = new Array(16).fill(0)
  const start = store.selectedDevice.value.startChannel - 1

  for (let i = 0; i < laserChannels.value.length && start + i < 16; i++) {
    dmx[start + i] = laserChannels.value[i]
  }

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
        <!-- No device selected state -->
        <div v-if="!store.selectedDevice.value" class="py-8 text-center">
          <div class="text-zinc-500 text-xs mb-2">No device selected</div>
          <div class="text-zinc-600 text-[10px]">Select a device from the left panel</div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════
             LASER CHANNEL SLIDERS (controlType: 'sliders')
             ═══════════════════════════════════════════════════════════ -->
        <template v-else-if="controlType === 'sliders' && selectedProfile">
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
        <template v-else>
          <!-- Master Dimmer -->
          <div class="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
            <label class="text-xs font-medium text-zinc-400">Master</label>
            <input
              v-model.number="masterDimmer"
              type="range"
              min="0"
              max="100"
              class="flex-1 h-1.5 cursor-pointer accent-green-500"
            >
            <span class="text-xs font-mono text-green-400 min-w-[40px] text-right">{{ masterDimmer }}%</span>
          </div>

          <!-- Color Grid - GLOWING PADS -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-green-400/70 mb-2">Colors</span>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="preset in colorPresets"
                :key="preset.id"
                class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                       border-2 flex items-center justify-center"
                :class="store.selectedPresetId.value === preset.id
                  ? 'border-white scale-105 z-10'
                  : 'border-transparent hover:scale-105'"
                :style="{
                  background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                  boxShadow: store.selectedPresetId.value === preset.id
                    ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                    : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
                }"
                :title="preset.name"
                @click="handlePresetClick(preset.id)"
              >
                <span class="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] uppercase">
                  {{ preset.name }}
                </span>
              </button>
            </div>
          </div>

          <!-- Strobe Buttons -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-green-400/70 mb-2">Strobe</span>
            <div class="flex gap-1.5">
              <button
                v-for="preset in strobePresets"
                :key="preset.id"
                class="flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200
                       border border-zinc-800"
                :class="store.selectedPresetId.value === preset.id
                  ? 'bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_15px_#22c55e30]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'"
                @click="handlePresetClick(preset.id)"
              >
                {{ preset.name.replace('Strobe ', '') }}
              </button>
            </div>
          </div>

          <!-- Dimmer Presets -->
          <div>
            <span class="block text-[10px] font-mono uppercase tracking-widest text-green-400/70 mb-2">Dimmer</span>
            <div class="flex gap-1.5">
              <button
                v-for="preset in dimmerPresets"
                :key="preset.id"
                class="flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200
                       border border-zinc-800"
                :class="store.selectedPresetId.value === preset.id
                  ? 'bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_15px_#22c55e30]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'"
                @click="handlePresetClick(preset.id)"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>

          <!-- Custom Presets -->
          <div v-if="customPresets.length > 0">
            <span class="block text-[10px] font-mono uppercase tracking-widest text-green-400/70 mb-2">Custom</span>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="preset in customPresets"
                :key="preset.id"
                class="color-pad aspect-square rounded-lg transition-all duration-200 relative overflow-hidden
                       border-2 flex items-center justify-center"
                :class="store.selectedPresetId.value === preset.id
                  ? 'border-white scale-105 z-10'
                  : 'border-transparent hover:scale-105'"
                :style="{
                  background: `linear-gradient(135deg, ${getPreviewColor(preset.values)} 0%, color-mix(in srgb, ${getPreviewColor(preset.values)} 70%, black) 100%)`,
                  boxShadow: store.selectedPresetId.value === preset.id
                    ? `0 0 20px ${getPreviewColor(preset.values)}, 0 4px 12px rgba(0,0,0,0.4)`
                    : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
                }"
                :title="preset.name"
                @click="handlePresetClick(preset.id)"
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
            + Add Custom Preset
          </button>
        </template>
      </div>
    </section>

    <!-- Add Preset Dialog -->
    <Dialog :open="showAddPreset" @update:open="showAddPreset = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Preset</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="preset-name">Name</Label>
            <Input
              id="preset-name"
              v-model="newPresetName"
              placeholder="e.g. My Color"
              @keyup.enter="handleAddPreset"
            />
          </div>

          <div class="grid gap-2">
            <Label>Dimmer</Label>
            <div class="slider-row">
              <input
                v-model.number="newPresetValues.dimmer"
                type="range"
                min="0"
                max="255"
                class="color-slider"
              >
              <span class="slider-value">{{ newPresetValues.dimmer }}</span>
            </div>
          </div>

          <div class="color-sliders">
            <div class="grid gap-1">
              <Label>Red</Label>
              <input
                v-model.number="newPresetValues.red"
                type="range"
                min="0"
                max="255"
                class="color-slider red"
              >
            </div>
            <div class="grid gap-1">
              <Label>Green</Label>
              <input
                v-model.number="newPresetValues.green"
                type="range"
                min="0"
                max="255"
                class="color-slider green"
              >
            </div>
            <div class="grid gap-1">
              <Label>Blue</Label>
              <input
                v-model.number="newPresetValues.blue"
                type="range"
                min="0"
                max="255"
                class="color-slider blue"
              >
            </div>
            <div class="grid gap-1">
              <Label>White</Label>
              <input
                v-model.number="newPresetValues.white"
                type="range"
                min="0"
                max="255"
                class="color-slider white"
              >
            </div>
          </div>

          <div class="color-preview" :style="{ backgroundColor: getPreviewColor(newPresetValues) }">
            Preview
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAddPreset = false">Cancel</Button>
          <Button @click="handleAddPreset">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/* Dialog-specific styles */
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-slider {
  flex: 1;
  height: 8px;
  cursor: pointer;
  accent-color: #22c55e;
}

.slider-value {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  min-width: 32px;
  text-align: right;
  color: #8888a0;
}

.color-sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.color-slider.red { accent-color: #ef4444; }
.color-slider.green { accent-color: #22c55e; }
.color-slider.blue { accent-color: #3b82f6; }
.color-slider.white { accent-color: #ffffff; }

.color-preview {
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: white;
  border: 1px solid #2a2b36;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
