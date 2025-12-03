<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { getPreviewColor, createDefaultValues } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- ═══════════════════════════════════════════════════════════
         PRESETS SECTION
         ═══════════════════════════════════════════════════════════ -->
    <section class="flex-1 border-b border-zinc-800/50">
      <!-- Section Header with LED indicator -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="presetsExpanded = !presetsExpanded"
      >
        <div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Presets</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ String(store.presets.value.length).padStart(2, '0') }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="presetsExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <div v-if="presetsExpanded" class="px-3 py-3 space-y-4">
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
              @click="store.selectPreset(preset.id)"
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
              @click="store.selectPreset(preset.id)"
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
              @click="store.selectPreset(preset.id)"
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
              @click="store.selectPreset(preset.id)"
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
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         SCENES SECTION
         ═══════════════════════════════════════════════════════════ -->
    <section class="border-b border-zinc-800/50">
      <!-- Section Header with LED indicator -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="scenesExpanded = !scenesExpanded"
      >
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="store.scenes.value.length > 0
            ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
            : 'bg-zinc-700'"
        />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Scenes</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ String(store.scenes.value.length).padStart(2, '0') }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="scenesExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <div v-if="scenesExpanded" class="px-2 py-2">
        <div
          v-for="scene in store.scenes.value"
          :key="scene.id"
          class="group flex flex-col gap-0.5 px-3 py-2.5 rounded cursor-pointer transition-all duration-200
                 border-l-2"
          :class="store.selectedSceneId.value === scene.id
            ? 'bg-green-500/10 border-green-500 shadow-[inset_0_0_20px_#22c55e08]'
            : 'border-transparent hover:bg-zinc-800/40 hover:border-green-500/30'"
          @click="store.selectScene(scene.id)"
        >
          <span class="text-sm text-zinc-300 group-hover:text-white transition-colors"
                :class="{ 'text-green-400': store.selectedSceneId.value === scene.id }">
            {{ scene.name }}
          </span>
          <span class="text-[10px] font-mono text-zinc-600">
            {{ scene.tracks.length }} tracks · {{ scene.clips.length }} clips
          </span>
        </div>

        <div v-if="store.scenes.value.length === 0" class="py-6 text-center text-zinc-400 text-xs">
          No scenes yet. Save a Set as Scene in the editor.
        </div>
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
