<script setup lang="ts">
import { PINSPOT_RGBW } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  fixtureId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { fixtures, profiles, addFixture, updateFixture, deleteFixture } = useDMXStore()

const isEditing = computed(() => props.fixtureId !== null)
const existingFixture = computed(() =>
  props.fixtureId ? fixtures.value.find(f => f.id === props.fixtureId) : null
)

// Form state
const name = ref('')
const startChannel = ref(1)
const profileId = ref(PINSPOT_RGBW.id)
const tagsInput = ref('')

// Initialize form when editing
watchEffect(() => {
  if (existingFixture.value) {
    name.value = existingFixture.value.name
    startChannel.value = existingFixture.value.startChannel
    profileId.value = existingFixture.value.profileId
    tagsInput.value = existingFixture.value.tags.join(', ')
  } else {
    name.value = `Fixture ${fixtures.value.length + 1}`
    const usedChannels = fixtures.value.map(f => {
      const p = profiles.value.find(p => p.id === f.profileId)
      return { start: f.startChannel, end: f.startChannel + (p?.channelCount || 5) - 1 }
    })
    let nextChannel = 1
    for (const used of usedChannels.sort((a, b) => a.start - b.start)) {
      if (nextChannel >= used.start && nextChannel <= used.end) {
        nextChannel = used.end + 1
      }
    }
    startChannel.value = nextChannel
    profileId.value = PINSPOT_RGBW.id
    tagsInput.value = ''
  }
})

function handleSave() {
  const tags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)

  if (isEditing.value && props.fixtureId) {
    updateFixture(props.fixtureId, {
      name: name.value,
      startChannel: startChannel.value,
      profileId: profileId.value,
      tags,
    })
  } else {
    addFixture({
      name: name.value,
      startChannel: startChannel.value,
      profileId: profileId.value,
      tags,
    })
  }

  emit('close')
}

function handleDelete() {
  if (props.fixtureId && confirm('Delete this fixture?')) {
    deleteFixture(props.fixtureId)
    emit('close')
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent class="max-w-md bg-neutral-900 border-neutral-700 text-white">
      <DialogHeader>
        <DialogTitle class="text-white">{{ isEditing ? 'Edit Fixture' : 'Add Fixture' }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Name</label>
          <Input v-model="name" type="text" placeholder="e.g. Front Left" class="bg-neutral-800 border-neutral-600 text-white" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Start Channel (1-512)</label>
          <Input v-model.number="startChannel" type="number" min="1" max="512" class="bg-neutral-800 border-neutral-600 text-white" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Profile</label>
          <select
            v-model="profileId"
            class="w-full h-9 bg-neutral-800 border border-neutral-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option v-for="p in profiles" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.channelCount }} ch)
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Tags (comma separated)</label>
          <Input v-model="tagsInput" type="text" placeholder="e.g. front, stage-left" class="bg-neutral-800 border-neutral-600 text-white" />
        </div>
      </div>

      <DialogFooter class="flex gap-2">
        <Button v-if="isEditing" variant="destructive" @click="handleDelete">Delete</Button>
        <div class="flex-1"></div>
        <Button variant="secondary" @click="emit('close')">Cancel</Button>
        <Button class="bg-green-600 hover:bg-green-700 text-white" @click="handleSave">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
