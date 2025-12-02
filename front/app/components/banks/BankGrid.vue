<script setup lang="ts">
import { getPreviewColor } from '~/types/dmx'

const { selectedBank, scenes, presets, setBankCell, getScene } = useDMXStore()
const { currentCellIndex, currentBeatInBank } = useBankPlayer()
const { state: linkState } = useAbletonLink()

const CELL_WIDTH = 80

const cellCount = computed(() => {
  if (!selectedBank.value) return 0
  return Math.round(selectedBank.value.length / selectedBank.value.unitDuration)
})

const gridWidth = computed(() => cellCount.value * CELL_WIDTH)

// Get preview colors for a scene
function getSceneColors(sceneId: string | null): string[] {
  if (!sceneId) return []
  const scene = getScene(sceneId)
  if (!scene) return []

  return scene.presetIds.map(pid => {
    const preset = presets.value.find(p => p.id === pid)
    return preset ? getPreviewColor(preset.values) : '#333'
  })
}

// Beat indicator position
const beatIndicatorLeft = computed(() => {
  if (!selectedBank.value || currentBeatInBank.value < 0) return -100
  return (currentBeatInBank.value / selectedBank.value.unitDuration) * CELL_WIDTH
})

function handleCellClick(cellIndex: number) {
  if (!selectedBank.value) return
  // Cycle through: null -> first scene -> second scene -> ... -> null
  const currentSceneId = selectedBank.value.cells[cellIndex]
  const currentIdx = currentSceneId ? scenes.value.findIndex(s => s.id === currentSceneId) : -1
  const nextIdx = currentIdx + 1

  if (nextIdx >= scenes.value.length) {
    setBankCell(selectedBank.value.id, cellIndex, null)
  } else {
    setBankCell(selectedBank.value.id, cellIndex, scenes.value[nextIdx].id)
  }
}

function handleCellRightClick(cellIndex: number, event: MouseEvent) {
  event.preventDefault()
  if (!selectedBank.value) return
  setBankCell(selectedBank.value.id, cellIndex, null)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!selectedBank" class="text-neutral-500 text-center py-8">
      Select a bank from the list above
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-bold text-white">{{ selectedBank.name }}</h3>
        <span class="text-xs text-neutral-500">
          Click cell to cycle scenes, right-click to clear
        </span>
      </div>

      <div class="overflow-x-auto">
        <div class="relative" :style="{ width: `${gridWidth}px` }">
          <div class="flex">
            <div
              v-for="i in cellCount"
              :key="i"
              class="text-center text-xs text-neutral-500 font-mono"
              :style="{ width: `${CELL_WIDTH}px` }"
            >
              {{ ((i - 1) * selectedBank.unitDuration) + 1 }}
            </div>
          </div>

          <div
            class="relative h-20 bg-neutral-900 border border-neutral-700 rounded flex"
            :style="{ width: `${gridWidth}px` }"
          >
            <div
              v-for="(sceneId, idx) in selectedBank.cells"
              :key="idx"
              class="h-full border-r border-neutral-700 cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors"
              :class="[
                currentCellIndex === idx && linkState.isPlaying ? 'bg-green-900/30' : 'hover:bg-neutral-800',
              ]"
              :style="{ width: `${CELL_WIDTH}px` }"
              @click="handleCellClick(idx)"
              @contextmenu="handleCellRightClick(idx, $event)"
            >
              <template v-if="sceneId">
                <div class="flex gap-0.5">
                  <div
                    v-for="(color, colorIdx) in getSceneColors(sceneId)"
                    :key="colorIdx"
                    class="w-3 h-3 rounded-sm"
                    :style="{ backgroundColor: color }"
                  ></div>
                </div>
                <span class="text-[10px] text-neutral-300 truncate max-w-full px-1">
                  {{ getScene(sceneId)?.name }}
                </span>
              </template>
              <span v-else class="text-neutral-600 text-xs">-</span>
            </div>

            <div
              v-if="linkState.isPlaying && currentBeatInBank >= 0"
              class="absolute top-0 bottom-0 w-0.5 bg-green-500 z-10 pointer-events-none transition-all"
              :style="{ left: `${beatIndicatorLeft}px` }"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="scenes.length === 0" class="text-neutral-500 text-sm text-center py-2">
        No scenes available. Create scenes in the Scenes tab first.
      </div>

      <div v-else class="flex flex-wrap gap-2 mt-2">
        <div class="text-xs text-neutral-500">Available scenes:</div>
        <div
          v-for="scene in scenes"
          :key="scene.id"
          class="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1"
        >
          <div class="flex gap-0.5">
            <div
              v-for="(color, idx) in getSceneColors(scene.id)"
              :key="idx"
              class="w-2 h-2 rounded-sm"
              :style="{ backgroundColor: color }"
            ></div>
          </div>
          <span class="text-xs text-white">{{ scene.name }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
