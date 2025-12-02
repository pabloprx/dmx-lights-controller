<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { createDefaultValues } from '~/types/dmx'

const {
  fixtures,
  presets,
  selectedPresetId,
  selectPreset,
  addPreset,
  getPresetsForFixture,
} = useDMXStore()

const showEditor = ref(false)
const editingPresetId = ref<string | null>(null)

// Track which fixtures are expanded
const expandedFixtures = ref<Set<string>>(new Set())

// Expand all by default if there are fixtures
watchEffect(() => {
  if (fixtures.value.length > 0 && expandedFixtures.value.size === 0) {
    fixtures.value.forEach(f => expandedFixtures.value.add(f.id))
  }
})

function toggleFixture(fixtureId: string) {
  if (expandedFixtures.value.has(fixtureId)) {
    expandedFixtures.value.delete(fixtureId)
  } else {
    expandedFixtures.value.add(fixtureId)
  }
}

function handleAdd(fixtureId: string) {
  const fixture = fixtures.value.find(f => f.id === fixtureId)
  const presetCount = getPresetsForFixture(fixtureId).length

  addPreset({
    name: `Preset ${presetCount + 1}`,
    fixtureId,
    values: createDefaultValues(),
  })
}

function handleEdit(presetId: string) {
  editingPresetId.value = presetId
  showEditor.value = true
}

function handleSelect(presetId: string) {
  selectPreset(presetId)
}

function handleEditorClose() {
  showEditor.value = false
  editingPresetId.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-4 border-b border-neutral-700">
      <h2 class="text-lg font-bold text-white">Presets</h2>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="fixtures.length === 0" class="text-neutral-400 text-center py-8">
        No fixtures yet. Add fixtures first in the Fixtures tab.
      </div>

      <div v-else class="flex flex-col gap-4">
        <div v-for="fixture in fixtures" :key="fixture.id" class="bg-neutral-900 rounded-lg overflow-hidden">
          <div
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-800"
            @click="toggleFixture(fixture.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-neutral-400">{{ expandedFixtures.has(fixture.id) ? '▼' : '▶' }}</span>
              <span class="font-medium text-white">{{ fixture.name }}</span>
              <span class="text-xs text-neutral-500">
                ({{ getPresetsForFixture(fixture.id).length }} presets)
              </span>
            </div>
            <Button
              size="sm"
              class="bg-green-600 hover:bg-green-700 text-white"
              @click.stop="handleAdd(fixture.id)"
            >
              + Add
            </Button>
          </div>

          <div v-if="expandedFixtures.has(fixture.id)" class="p-3 pt-0 flex flex-col gap-2">
            <PresetsPresetCard
              v-for="preset in getPresetsForFixture(fixture.id)"
              :key="preset.id"
              :preset="preset"
              :selected="preset.id === selectedPresetId"
              @select="handleSelect(preset.id)"
              @edit="handleEdit(preset.id)"
            />

            <div
              v-if="getPresetsForFixture(fixture.id).length === 0"
              class="text-neutral-500 text-sm text-center py-4"
            >
              No presets yet. Click + Add to create one.
            </div>
          </div>
        </div>
      </div>
    </div>

    <PresetsPresetEditor
      v-if="showEditor"
      :preset-id="editingPresetId"
      @close="handleEditorClose"
    />
  </div>
</template>
