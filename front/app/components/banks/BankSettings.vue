<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  bankId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { banks, updateBank, deleteBank } = useDMXStore()

const bank = computed(() => banks.value.find(b => b.id === props.bankId))

const name = ref('')
const length = ref(8)
const unitDuration = ref(1)

watchEffect(() => {
  if (bank.value) {
    name.value = bank.value.name
    length.value = bank.value.length
    unitDuration.value = bank.value.unitDuration
  }
})

const lengthOptions = [2, 4, 8, 16]
const unitOptions = [
  { value: 1, label: '1 beat' },
  { value: 0.5, label: '½ beat' },
  { value: 0.25, label: '¼ beat' },
]

function handleSave() {
  updateBank(props.bankId, {
    name: name.value,
    length: length.value,
    unitDuration: unitDuration.value,
  })
  emit('close')
}

function handleDelete() {
  if (confirm('Delete this bank?')) {
    deleteBank(props.bankId)
    emit('close')
  }
}
</script>

<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent class="max-w-sm bg-neutral-900 border-neutral-700 text-white">
      <DialogHeader>
        <DialogTitle class="text-white">Bank Settings</DialogTitle>
      </DialogHeader>

      <div v-if="bank" class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Name</label>
          <Input
            v-model="name"
            type="text"
            class="bg-neutral-800 border-neutral-600 text-white"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Length (beats)</label>
          <div class="flex gap-1">
            <button
              v-for="opt in lengthOptions"
              :key="opt"
              class="flex-1 py-2 rounded text-sm"
              :class="length === opt
                ? 'bg-green-500 text-black'
                : 'bg-neutral-700 text-white hover:bg-neutral-600'"
              @click="length = opt"
            >
              {{ opt }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Unit Duration</label>
          <div class="flex gap-1">
            <button
              v-for="opt in unitOptions"
              :key="opt.value"
              class="flex-1 py-2 rounded text-sm"
              :class="unitDuration === opt.value
                ? 'bg-green-500 text-black'
                : 'bg-neutral-700 text-white hover:bg-neutral-600'"
              @click="unitDuration = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="text-xs text-neutral-500">
          Total cells: {{ Math.round(length / unitDuration) }}
        </div>
      </div>

      <DialogFooter class="flex gap-2">
        <Button variant="destructive" @click="handleDelete">Delete</Button>
        <div class="flex-1"></div>
        <Button variant="secondary" @click="emit('close')">Cancel</Button>
        <Button class="bg-green-600 hover:bg-green-700 text-white" @click="handleSave">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
