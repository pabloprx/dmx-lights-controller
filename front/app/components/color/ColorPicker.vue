<script setup lang="ts">
import type { FixtureValues } from '~/types/dmx'
import { Slider } from '@/components/ui/slider'

const props = defineProps<{
  modelValue: FixtureValues
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FixtureValues]
}>()

const values = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function updateValue(key: keyof FixtureValues, val: number) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: Math.min(255, Math.max(0, val)),
  })
}

// Preview color (approximate RGB + W as brightness)
const previewColor = computed(() => {
  const { red, green, blue, white } = values.value
  const r = Math.min(255, red + white * 0.5)
  const g = Math.min(255, green + white * 0.5)
  const b = Math.min(255, blue + white * 0.5)
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
})

const channels: { key: keyof FixtureValues; label: string; color: string }[] = [
  { key: 'red', label: 'R', color: 'bg-red-500' },
  { key: 'green', label: 'G', color: 'bg-green-500' },
  { key: 'blue', label: 'B', color: 'bg-blue-500' },
  { key: 'white', label: 'W', color: 'bg-white' },
  { key: 'master', label: 'M', color: 'bg-yellow-400' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="w-full h-14 rounded-lg border-2 border-neutral-700" :style="{ backgroundColor: previewColor }"></div>

    <div class="flex flex-col gap-2">
      <div v-for="ch in channels" :key="ch.key" class="flex items-center gap-2">
        <span class="w-5 text-xs font-bold text-neutral-500">{{ ch.label }}</span>
        <Slider
          :model-value="[values[ch.key]]"
          :max="255"
          :step="1"
          class="flex-1"
          @update:model-value="(v) => updateValue(ch.key, v[0])"
        />
        <input
          type="number"
          min="0"
          max="255"
          :value="values[ch.key]"
          class="w-12 bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-white text-xs text-center font-mono focus:outline-none focus:border-green-500"
          @input="updateValue(ch.key, +($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
