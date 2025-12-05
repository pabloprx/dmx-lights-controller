<script setup lang="ts">
import { useMIDIMapper, type MIDIMapping, type MIDIActionType } from '~/composables/useMIDIMapper'
import { useMIDI } from '~/composables/useMIDI'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const mapper = useMIDIMapper()
const midi = useMIDI()

// Filter to only valid mappings (safety net)
const validMappings = computed(() => {
  const arr = mapper.mappings.value || []
  return arr.filter(m =>
    m &&
    typeof m.id === 'string' &&
    typeof m.midiType === 'string' &&
    typeof m.midiNumber === 'number' &&
    m.action &&
    typeof m.action.type === 'string'
  )
})

// Edit state
const editingId = ref<string | null>(null)
const editForm = ref({
  name: '',
  midiType: 'cc' as 'cc' | 'note',
  midiNumber: 0,
  channel: 1,
  actionType: 'master:dimmer' as MIDIActionType,
})

// Available actions
const actionOptions: { value: MIDIActionType; label: string }[] = [
  { value: 'master:dimmer', label: 'Master Dimmer' },
  { value: 'master:blackout', label: 'Blackout Toggle' },
  { value: 'transport:play', label: 'Play/Pause' },
  { value: 'transport:stop', label: 'Stop' },
  { value: 'set:next', label: 'Next Set' },
  { value: 'set:prev', label: 'Previous Set' },
  { value: 'set:activate', label: 'Activate Set' },
  { value: 'set:trigger', label: 'Trigger Set (+ Play)' },
]

// Format MIDI input display
function formatMIDIInput(mapping: MIDIMapping): string {
  if (!mapping || typeof mapping.midiType !== 'string') return 'Unknown'
  const type = mapping.midiType.toUpperCase()
  return `${type} ${mapping.midiNumber ?? 0} (Ch${mapping.channel ?? 1})`
}

// Start editing a mapping
function startEdit(mapping: MIDIMapping) {
  editingId.value = mapping.id
  editForm.value = {
    name: mapping.name || 'Unnamed',
    midiType: mapping.midiType || 'cc',
    midiNumber: mapping.midiNumber ?? 0,
    channel: mapping.channel ?? 1,
    actionType: mapping.action?.type || 'master:dimmer',
  }
}

// Save edit
function saveEdit() {
  if (!editingId.value) return

  mapper.updateMapping(editingId.value, {
    name: editForm.value.name,
    midiType: editForm.value.midiType,
    midiNumber: editForm.value.midiNumber,
    channel: editForm.value.channel,
    action: { type: editForm.value.actionType },
  })

  editingId.value = null
}

// Cancel edit
function cancelEdit() {
  editingId.value = null
}

// Start adding new mapping
function startAdd() {
  editingId.value = 'new'
  editForm.value = {
    name: 'New Mapping',
    midiType: 'note',
    midiNumber: 60,
    channel: 1,
    actionType: 'transport:play',
  }
}

// Save new mapping
function saveNew() {
  mapper.addMapping({
    name: editForm.value.name,
    midiType: editForm.value.midiType,
    midiNumber: editForm.value.midiNumber,
    channel: editForm.value.channel,
    action: { type: editForm.value.actionType },
  })
  editingId.value = null
}

// Learn MIDI input
function learnMIDI() {
  mapper.startLearning((event) => {
    editForm.value.midiType = event.type
    editForm.value.midiNumber = event.number
    editForm.value.channel = event.channel
  })
}

// Get note name
function getNoteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(note / 12) - 1
  const name = names[note % 12]
  return `${name}${octave}`
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl bg-neutral-900 border-neutral-700 text-white max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="text-white flex items-center gap-2">
          <span class="text-xl">MIDI Configuration</span>
          <span
            v-if="midi.isConnected.value"
            class="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400"
          >
            Connected
          </span>
          <span
            v-else
            class="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400"
          >
            Not Connected
          </span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <!-- Actions bar -->
        <div class="flex gap-2">
          <Button
            size="sm"
            class="bg-green-600 hover:bg-green-700"
            @click="startAdd"
          >
            + Add Mapping
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="mapper.loadDefaults()"
          >
            Load Defaults
          </Button>
          <div class="flex-1" />
          <Button
            v-if="!midi.isConnected.value"
            size="sm"
            variant="outline"
            @click="midi.connect()"
          >
            Connect MIDI
          </Button>
        </div>

        <!-- Mappings list -->
        <div class="flex flex-col gap-2">
          <!-- New mapping form (at top for visibility) -->
          <div
            v-if="editingId === 'new'"
            class="p-4 rounded-lg bg-green-500/10 border border-green-500/30"
          >
            <div class="grid grid-cols-2 gap-3 mb-3">
              <!-- Name -->
              <div>
                <label class="text-xs text-neutral-400 mb-1 block">Name</label>
                <Input
                  v-model="editForm.name"
                  placeholder="Mapping name"
                  class="bg-neutral-700 border-neutral-600 w-full"
                />
              </div>
              <!-- Action -->
              <div>
                <label class="text-xs text-neutral-400 mb-1 block">Action</label>
                <select
                  v-model="editForm.actionType"
                  class="w-full px-3 py-2 rounded bg-neutral-700 border border-neutral-600 text-sm"
                >
                  <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="flex items-end gap-3">
              <!-- MIDI Input -->
              <div class="flex-1">
                <label class="text-xs text-neutral-400 mb-1 block">MIDI Input</label>
                <div class="flex gap-2">
                  <select
                    v-model="editForm.midiType"
                    class="px-3 py-2 rounded bg-neutral-700 border border-neutral-600 text-sm"
                  >
                    <option value="cc">CC</option>
                    <option value="note">Note</option>
                  </select>
                  <Input
                    v-model.number="editForm.midiNumber"
                    type="number"
                    min="0"
                    max="127"
                    class="w-20 bg-neutral-700 border-neutral-600"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    :class="mapper.isLearning.value ? 'animate-pulse bg-amber-500/20 border-amber-500' : ''"
                    @click="learnMIDI"
                  >
                    {{ mapper.isLearning.value ? 'Press key...' : 'Learn' }}
                  </Button>
                </div>
              </div>
              <!-- Buttons -->
              <div class="flex gap-2">
                <Button size="sm" class="bg-green-600 hover:bg-green-700" @click="saveNew">Add</Button>
                <Button size="sm" variant="ghost" @click="editingId = null">Cancel</Button>
              </div>
            </div>
          </div>

          <div
            v-for="mapping in validMappings"
            :key="mapping.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-neutral-800 border border-neutral-700"
          >
            <template v-if="editingId === mapping.id">
              <!-- Edit mode -->
              <div class="flex-1 grid grid-cols-4 gap-2">
                <Input
                  v-model="editForm.name"
                  placeholder="Name"
                  class="bg-neutral-700 border-neutral-600"
                />
                <div class="flex gap-1">
                  <select
                    v-model="editForm.midiType"
                    class="flex-1 px-2 py-1 rounded bg-neutral-700 border border-neutral-600 text-sm"
                  >
                    <option value="cc">CC</option>
                    <option value="note">Note</option>
                  </select>
                  <Input
                    v-model.number="editForm.midiNumber"
                    type="number"
                    min="0"
                    max="127"
                    class="w-16 bg-neutral-700 border-neutral-600"
                  />
                </div>
                <select
                  v-model="editForm.actionType"
                  class="px-2 py-1 rounded bg-neutral-700 border border-neutral-600 text-sm"
                >
                  <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <div class="flex gap-1">
                  <Button size="sm" @click="saveEdit">Save</Button>
                  <Button size="sm" variant="ghost" @click="cancelEdit">Cancel</Button>
                </div>
              </div>
            </template>
            <template v-else>
              <!-- View mode -->
              <!-- Activity indicator -->
              <div class="w-3 h-3 rounded-full transition-all duration-100"
                   :class="mapper.lastTriggeredMappingId.value === mapping.id
                     ? (mapping.midiType === 'cc' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]')
                     : 'bg-neutral-700'" />
              <div class="flex-1">
                <div class="font-medium text-sm">{{ mapping.name }}</div>
                <div class="text-xs text-neutral-400">
                  {{ formatMIDIInput(mapping) }}
                  <span v-if="mapping.midiType === 'note'" class="text-neutral-500">
                    ({{ getNoteName(mapping.midiNumber) }})
                  </span>
                </div>
              </div>
              <div class="text-sm text-green-400 min-w-[100px]">
                {{ actionOptions.find(a => a.value === mapping.action?.type)?.label || 'Unknown' }}
                <!-- Show value for CC mappings -->
                <span v-if="mapping.midiType === 'cc' && mapper.lastTriggeredMappingId.value === mapping.id" class="text-neutral-400 ml-1">
                  ({{ mapper.lastTriggeredValue.value }})
                </span>
              </div>
              <div class="flex gap-1">
                <button
                  class="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
                  title="Edit"
                  @click="startEdit(mapping)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  class="p-1.5 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400"
                  title="Delete"
                  @click="mapper.deleteMapping(mapping.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </template>
          </div>

          <!-- Empty state -->
          <div
            v-if="validMappings.length === 0 && editingId !== 'new'"
            class="text-center py-8 text-neutral-500"
          >
            No mappings configured. Click "Add Mapping" or "Load Defaults" to get started.
          </div>
        </div>

        <!-- Last MIDI event display -->
        <div v-if="midi.lastEvent.value?.type" class="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
          <div class="text-xs text-neutral-400 mb-1">Last MIDI Event:</div>
          <div class="font-mono text-sm text-green-400">
            {{ midi.lastEvent.value.type.toUpperCase() }}
            <span v-if="midi.lastEvent.value.type === 'cc'">
              CC{{ midi.lastEvent.value.cc }} = {{ midi.lastEvent.value.value }}
            </span>
            <span v-else-if="midi.lastEvent.value.type === 'noteon' || midi.lastEvent.value.type === 'noteoff'">
              {{ midi.lastEvent.value.noteName }} ({{ midi.lastEvent.value.note }})
              vel={{ midi.lastEvent.value.velocity }}
            </span>
            <span class="text-neutral-500 ml-2">Ch{{ midi.lastEvent.value.channel }}</span>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
