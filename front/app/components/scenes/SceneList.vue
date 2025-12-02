<script setup lang="ts">
import { Button } from '@/components/ui/button'

const { scenes, selectedSceneId, selectScene, addScene } = useDMXStore()

const showEditor = ref(false)
const editingSceneId = ref<string | null>(null)

function handleAdd() {
  const sceneCount = scenes.value.length
  addScene({
    name: `Scene ${sceneCount + 1}`,
    presetIds: [],
  })
}

function handleEdit(sceneId: string) {
  editingSceneId.value = sceneId
  showEditor.value = true
}

function handleSelect(sceneId: string) {
  selectScene(sceneId)
}

function handleEditorClose() {
  showEditor.value = false
  editingSceneId.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-4 border-b border-neutral-700">
      <h2 class="text-lg font-bold text-white">Scenes</h2>
      <Button
        size="sm"
        class="bg-green-600 hover:bg-green-700 text-white"
        @click="handleAdd"
      >
        + Add
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="scenes.length === 0" class="text-neutral-400 text-center py-8">
        No scenes yet. Click + Add to create one.
      </div>

      <div v-else class="flex flex-col gap-3">
        <ScenesSceneCard
          v-for="scene in scenes"
          :key="scene.id"
          :scene="scene"
          :selected="scene.id === selectedSceneId"
          @select="handleSelect(scene.id)"
          @edit="handleEdit(scene.id)"
        />
      </div>
    </div>

    <ScenesSceneBuilder
      v-if="showEditor"
      :scene-id="editingSceneId"
      @close="handleEditorClose"
    />
  </div>
</template>
