<script setup lang="ts">
import { Button } from '@/components/ui/button'

const {
  fixtures,
  selectedFixtureId,
  selectFixture,
} = useDMXStore()

const showEditor = ref(false)
const editingFixtureId = ref<string | null>(null)

function handleAdd() {
  editingFixtureId.value = null
  showEditor.value = true
}

function handleEdit(id: string) {
  editingFixtureId.value = id
  showEditor.value = true
}

function handleSelect(id: string) {
  selectFixture(id)
}

function handleEditorClose() {
  showEditor.value = false
  editingFixtureId.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-3 border-b border-neutral-700">
      <h2 class="text-sm font-bold text-neutral-300 m-0">Fixtures</h2>
      <Button size="sm" class="bg-green-600 hover:bg-green-700 text-white" @click="handleAdd">+ Add</Button>
    </div>

    <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
      <FixturesFixtureCard
        v-for="fixture in fixtures"
        :key="fixture.id"
        :fixture="fixture"
        :selected="fixture.id === selectedFixtureId"
        @select="handleSelect(fixture.id)"
        @edit="handleEdit(fixture.id)"
      />

      <div v-if="fixtures.length === 0" class="text-neutral-400 text-center p-5 text-xs">
        No fixtures yet. Click + Add to create one.
      </div>
    </div>

    <FixturesFixtureEditor
      v-if="showEditor"
      :fixture-id="editingFixtureId"
      @close="handleEditorClose"
    />
  </div>
</template>
