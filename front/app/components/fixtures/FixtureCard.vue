<script setup lang="ts">
import type { Fixture } from '~/types/dmx'

const props = defineProps<{
  fixture: Fixture
  selected?: boolean
}>()

const emit = defineEmits<{
  select: []
  edit: []
}>()

const { getProfile } = useDMXStore()

const profile = computed(() => getProfile(props.fixture.profileId))
const channelRange = computed(() => {
  if (!profile.value) return ''
  const end = props.fixture.startChannel + profile.value.channelCount - 1
  return `CH ${props.fixture.startChannel}-${end}`
})
</script>

<template>
  <div
    class="bg-neutral-900 border-2 rounded-lg p-3 cursor-pointer"
    :class="selected ? 'border-green-500' : 'border-neutral-700 hover:border-neutral-500'"
    @click="emit('select')"
    @dblclick="emit('edit')"
  >
    <div class="font-bold text-sm mb-1">{{ fixture.name }}</div>
    <div class="text-xs text-neutral-500 font-mono">{{ channelRange }}</div>
    <div v-if="fixture.tags.length" class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="tag in fixture.tags"
        :key="tag"
        class="bg-neutral-700 px-1.5 py-0.5 rounded text-[10px] text-neutral-400"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>
