<script setup lang="ts">
import type { Scene } from '~/types/dmx'
import { getPreviewColor } from '~/types/dmx'

const props = defineProps<{
  scene: Scene
  selected?: boolean
}>()

const emit = defineEmits<{
  select: []
  edit: []
}>()

const { fixtures, getPreset } = useDMXStore()

// Get presets info for display
const scenePresets = computed(() => {
  return props.scene.presetIds.map(pid => {
    const preset = getPreset(pid)
    if (!preset) return null
    const fixture = fixtures.value.find(f => f.id === preset.fixtureId)
    return {
      preset,
      fixture,
      color: getPreviewColor(preset.values),
    }
  }).filter(Boolean)
})
</script>

<template>
  <div
    class="bg-neutral-800 border-2 rounded-lg p-3 cursor-pointer"
    :class="selected ? 'border-green-500' : 'border-neutral-700 hover:border-neutral-500'"
    @click="emit('select')"
    @dblclick="emit('edit')"
  >
    <div class="font-bold text-sm text-white mb-2">{{ scene.name }}</div>

    <div v-if="scenePresets.length === 0" class="text-xs text-neutral-500">
      No presets assigned
    </div>

    <div v-else class="flex flex-col gap-1">
      <div
        v-for="item in scenePresets"
        :key="item!.preset.id"
        class="flex items-center gap-2 text-xs"
      >
        <div
          class="w-4 h-4 rounded border border-neutral-600"
          :style="{ backgroundColor: item!.color }"
        ></div>
        <span class="text-neutral-400">{{ item!.fixture?.name }}:</span>
        <span class="text-white">{{ item!.preset.name }}</span>
        <span v-if="item!.preset.values.strobe" class="text-yellow-400">⚡</span>
      </div>
    </div>
  </div>
</template>
