<script setup lang="ts">
import type { Preset } from '~/types/dmx'
import { getPreviewColor } from '~/types/dmx'

const props = defineProps<{
  preset: Preset
  selected?: boolean
}>()

const emit = defineEmits<{
  select: []
  edit: []
}>()

const previewColor = computed(() => getPreviewColor(props.preset.values))

const dimmerPercent = computed(() =>
  Math.round((props.preset.values.dimmer / 255) * 100)
)
</script>

<template>
  <div
    class="bg-neutral-800 border-2 rounded-lg p-3 cursor-pointer flex items-center gap-3"
    :class="selected ? 'border-green-500' : 'border-neutral-700 hover:border-neutral-500'"
    @click="emit('select')"
    @dblclick="emit('edit')"
  >
    <div
      class="w-10 h-10 rounded-lg border border-neutral-600 flex-shrink-0"
      :style="{ backgroundColor: previewColor }"
    ></div>

    <div class="flex-1 min-w-0">
      <div class="font-bold text-sm text-white truncate">{{ preset.name }}</div>
      <div class="text-xs text-neutral-400 flex items-center gap-2">
        <span v-if="preset.values.strobe" class="text-yellow-400">
          ⚡ {{ preset.values.strobeSpeed }}
        </span>
        <span v-else>
          Dim: {{ dimmerPercent }}%
        </span>
      </div>
    </div>
  </div>
</template>
