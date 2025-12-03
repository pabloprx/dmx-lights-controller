<script setup lang="ts">
import type { FixtureValues, StrobeSpeed } from '~/types/dmx'
import { createDefaultValues, getPreviewColor, valuesToDMX } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'

const props = defineProps<{
  presetId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { presets, fixtures, addPreset, updatePreset, deletePreset, getPreset, selectedFixtureId, getFixture } = useDMXStore()
const { isTestingMode, blackout } = useAppMode()
const { isConnected: serialConnected, sendDMX } = useUnifiedSerial()

const isEditing = computed(() => props.presetId !== null)
const existingPreset = computed(() =>
  props.presetId ? getPreset(props.presetId) : null
)

// Form state
const name = ref('')
const fixtureId = ref('')
const values = ref<FixtureValues>(createDefaultValues())

// Initialize form
watchEffect(() => {
  if (existingPreset.value) {
    name.value = existingPreset.value.name
    fixtureId.value = existingPreset.value.fixtureId
    values.value = { ...existingPreset.value.values }
  } else {
    const presetCount = presets.value.length
    name.value = `Preset ${presetCount + 1}`
    fixtureId.value = selectedFixtureId.value || fixtures.value[0]?.id || ''
    values.value = createDefaultValues()
  }
})

const previewColor = computed(() => getPreviewColor(values.value))

// Live preview in testing mode - send DMX when values change
const currentFixture = computed(() => getFixture(fixtureId.value))

watch(
  () => ({ ...values.value, fixtureId: fixtureId.value }),
  () => {
    if (!isTestingMode.value || !serialConnected.value || blackout.value) return
    if (!currentFixture.value) return

    // Build DMX array with this preset's values at fixture's channels
    const dmxArray = new Array(16).fill(0)
    const channels = valuesToDMX(values.value)
    const startCh = currentFixture.value.startChannel - 1 // 0-indexed

    for (let i = 0; i < channels.length && startCh + i < 16; i++) {
      dmxArray[startCh + i] = channels[i]
    }

    sendDMX(dmxArray)
  },
  { deep: true }
)

const strobeOptions: { value: StrobeSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' },
]

function handleSave() {
  if (!fixtureId.value) return

  if (isEditing.value && props.presetId) {
    updatePreset(props.presetId, {
      name: name.value,
      fixtureId: fixtureId.value,
      values: { ...values.value },
    })
  } else {
    addPreset({
      name: name.value,
      fixtureId: fixtureId.value,
      values: { ...values.value },
    })
  }

  emit('close')
}

function handleDelete() {
  if (props.presetId && confirm('Delete this preset?')) {
    deletePreset(props.presetId)
    emit('close')
  }
}

function updateColor(key: 'red' | 'green' | 'blue' | 'white', val: number) {
  values.value[key] = Math.min(255, Math.max(0, val))
}
</script>

<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent class="max-w-md bg-neutral-900 border-neutral-700 text-white">
      <DialogHeader>
        <DialogTitle class="text-white">{{ isEditing ? 'Edit Preset' : 'Add Preset' }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Name</label>
          <Input
            v-model="name"
            type="text"
            placeholder="e.g. Red Strobe"
            class="bg-neutral-800 border-neutral-600 text-white"
          />
        </div>

        <div v-if="!isEditing" class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Fixture</label>
          <select
            v-model="fixtureId"
            class="w-full h-9 bg-neutral-800 border border-neutral-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option v-for="f in fixtures" :key="f.id" :value="f.id">
              {{ f.name }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs text-neutral-400">Preview</label>
          <div
            class="w-full h-16 rounded-lg border-2 border-neutral-700"
            :style="{ backgroundColor: previewColor }"
          ></div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-400">Mode</label>
            <div class="flex gap-2">
              <button
                class="px-3 py-1 rounded text-sm"
                :class="!values.strobe ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-300'"
                @click="values.strobe = false"
              >
                Dimmer
              </button>
              <button
                class="px-3 py-1 rounded text-sm"
                :class="values.strobe ? 'bg-yellow-500 text-black' : 'bg-neutral-700 text-neutral-300'"
                @click="values.strobe = true"
              >
                ⚡ Strobe
              </button>
            </div>
          </div>

          <div v-if="!values.strobe" class="flex items-center gap-3">
            <span class="w-16 text-xs text-neutral-400">Dimmer</span>
            <Slider
              :model-value="[values.dimmer]"
              :max="255"
              :step="1"
              class="flex-1"
              @update:model-value="(v) => values.dimmer = v[0]"
            />
            <span class="w-10 text-xs text-neutral-400 text-right">{{ Math.round((values.dimmer / 255) * 100) }}%</span>
          </div>

          <div v-else class="flex items-center gap-2">
            <span class="text-xs text-neutral-400">Speed:</span>
            <button
              v-for="opt in strobeOptions"
              :key="opt.value"
              class="px-3 py-1 rounded text-sm"
              :class="values.strobeSpeed === opt.value ? 'bg-yellow-500 text-black' : 'bg-neutral-700 text-neutral-300'"
              @click="values.strobeSpeed = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs text-neutral-400">RGBW Color</label>

          <div class="flex items-center gap-2">
            <span class="w-6 text-xs font-bold text-red-400">R</span>
            <Slider
              :model-value="[values.red]"
              :max="255"
              :step="1"
              class="flex-1"
              @update:model-value="(v) => updateColor('red', v[0])"
            />
            <input
              type="number"
              min="0"
              max="255"
              :value="values.red"
              class="w-14 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-xs text-center"
              @input="updateColor('red', +($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="w-6 text-xs font-bold text-green-400">G</span>
            <Slider
              :model-value="[values.green]"
              :max="255"
              :step="1"
              class="flex-1"
              @update:model-value="(v) => updateColor('green', v[0])"
            />
            <input
              type="number"
              min="0"
              max="255"
              :value="values.green"
              class="w-14 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-xs text-center"
              @input="updateColor('green', +($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="w-6 text-xs font-bold text-blue-400">B</span>
            <Slider
              :model-value="[values.blue]"
              :max="255"
              :step="1"
              class="flex-1"
              @update:model-value="(v) => updateColor('blue', v[0])"
            />
            <input
              type="number"
              min="0"
              max="255"
              :value="values.blue"
              class="w-14 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-xs text-center"
              @input="updateColor('blue', +($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="w-6 text-xs font-bold text-neutral-200">W</span>
            <Slider
              :model-value="[values.white]"
              :max="255"
              :step="1"
              class="flex-1"
              @update:model-value="(v) => updateColor('white', v[0])"
            />
            <input
              type="number"
              min="0"
              max="255"
              :value="values.white"
              class="w-14 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-xs text-center"
              @input="updateColor('white', +($event.target as HTMLInputElement).value)"
            />
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
