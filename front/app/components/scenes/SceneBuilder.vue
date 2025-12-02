<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPreviewColor } from '~/types/dmx'

const props = defineProps<{
  sceneId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { scenes, fixtures, presets, addScene, updateScene, deleteScene, getScene, getPresetsForFixture } = useDMXStore()

const isEditing = computed(() => props.sceneId !== null)
const existingScene = computed(() =>
  props.sceneId ? getScene(props.sceneId) : null
)

// Form state
const name = ref('')
const selectedPresets = ref<Map<string, string | null>>(new Map()) // fixtureId -> presetId

// Initialize form
watchEffect(() => {
  if (existingScene.value) {
    name.value = existingScene.value.name
    // Build map from presetIds
    selectedPresets.value = new Map()
    for (const fixture of fixtures.value) {
      const presetId = existingScene.value.presetIds.find(pid => {
        const preset = presets.value.find(p => p.id === pid)
        return preset?.fixtureId === fixture.id
      })
      selectedPresets.value.set(fixture.id, presetId || null)
    }
  } else {
    const sceneCount = scenes.value.length
    name.value = `Scene ${sceneCount + 1}`
    selectedPresets.value = new Map()
    for (const fixture of fixtures.value) {
      selectedPresets.value.set(fixture.id, null)
    }
  }
})

function setPresetForFixture(fixtureId: string, presetId: string | null) {
  selectedPresets.value.set(fixtureId, presetId)
}

function handleSave() {
  // Collect all selected presets
  const presetIds = Array.from(selectedPresets.value.values()).filter((id): id is string => id !== null)

  if (isEditing.value && props.sceneId) {
    updateScene(props.sceneId, {
      name: name.value,
      presetIds,
    })
  } else {
    addScene({
      name: name.value,
      presetIds,
    })
  }

  emit('close')
}

function handleDelete() {
  if (props.sceneId && confirm('Delete this scene?')) {
    deleteScene(props.sceneId)
    emit('close')
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent class="max-w-lg bg-neutral-900 border-neutral-700 text-white">
      <DialogHeader>
        <DialogTitle class="text-white">{{ isEditing ? 'Edit Scene' : 'Build Scene' }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Scene Name</label>
          <Input
            v-model="name"
            type="text"
            placeholder="e.g. Intro, Drop, Breakdown"
            class="bg-neutral-800 border-neutral-600 text-white"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs text-neutral-400">Assign Presets to Fixtures</label>

          <div v-if="fixtures.length === 0" class="text-neutral-500 text-sm py-4 text-center">
            No fixtures available. Add fixtures first.
          </div>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="fixture in fixtures"
              :key="fixture.id"
              class="flex items-center gap-3 bg-neutral-800 rounded-lg p-3"
            >
              <div class="flex-1">
                <div class="font-medium text-sm text-white">{{ fixture.name }}</div>
                <div class="text-xs text-neutral-500">CH {{ fixture.startChannel }}-{{ fixture.startChannel + 4 }}</div>
              </div>

              <select
                :value="selectedPresets.get(fixture.id) || ''"
                class="w-40 h-8 bg-neutral-700 border border-neutral-600 rounded px-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                @change="setPresetForFixture(fixture.id, ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">Off</option>
                <option
                  v-for="preset in getPresetsForFixture(fixture.id)"
                  :key="preset.id"
                  :value="preset.id"
                >
                  {{ preset.name }}
                </option>
              </select>

              <div
                v-if="selectedPresets.get(fixture.id)"
                class="w-6 h-6 rounded border border-neutral-600"
                :style="{
                  backgroundColor: (() => {
                    const preset = presets.find(p => p.id === selectedPresets.get(fixture.id))
                    return preset ? getPreviewColor(preset.values) : 'transparent'
                  })()
                }"
              ></div>
              <div v-else class="w-6 h-6 rounded border border-neutral-700 bg-neutral-900"></div>
            </div>
          </div>
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
