<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMIDI } from '~/composables/useMIDI'
import { useMIDIMapper } from '~/composables/useMIDIMapper'
import { useGamepadMapper } from '~/composables/useGamepadMapper'
import { useDMXStore } from '~/composables/useDMXStore'
import { ACTION_CATALOG, type InputActionType } from '~/composables/useInputActions'
import { XBOX_BUTTON_LABELS, XBOX_AXIS_LABELS } from '~/composables/useGamepad'
import GamepadLegend from '~/components/inputs/GamepadLegend.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const tab = ref<'midi' | 'gamepad'>('midi')

const midi = useMIDI()
const midiMapper = useMIDIMapper()
const gpMapper = useGamepadMapper()
const store = useDMXStore()

const actionOptions = ACTION_CATALOG

function needsSet(type: InputActionType) { return ACTION_CATALOG.find(a => a.type === type)?.needsSet }
function isIndexAction(type: InputActionType) { return type === 'set:index' }
function isPadAction(type: InputActionType) { return type === 'pad:fx' }

// pad:fx launch quantize: numbers (beats) or 'length' = phase-locked global sync
function parsePadQuantize(v: string): number | 'length' {
  return v === 'length' ? 'length' : Number(v)
}
const PAD_QUANTIZE_OPTIONS = [
  { value: '1', label: 'Launch: next beat' },
  { value: '2', label: 'Launch: 2 beats' },
  { value: '4', label: 'Launch: 4 beats' },
  { value: '8', label: 'Launch: 8 beats' },
  { value: 'length', label: 'Launch: global sync' },
]
const PAD_RELEASE_OPTIONS = [
  { value: '0.25', label: 'Rel: 1/4' },
  { value: '0.5', label: 'Rel: 1/2' },
  { value: '1', label: 'Rel: beat' },
]
const PAD_MINHOLD_OPTIONS = [
  { value: '0.5', label: 'Min: 1/2' },
  { value: '1', label: 'Min: 1 beat' },
  { value: '2', label: 'Min: 2 beats' },
  { value: '4', label: 'Min: 4 beats' },
]

// ── MIDI ──────────────────────────────────────────────
function midiTriggerLabel(m: { midiType: string; midiNumber: number; channel: number }) {
  return `${m.midiType.toUpperCase()} ${m.midiNumber} · ch${m.channel}`
}
function learnMidi() {
  midiMapper.startLearning((e) => {
    midiMapper.addMapping({
      name: `${e.type.toUpperCase()} ${e.number}`,
      midiType: e.type,
      midiNumber: e.number,
      channel: e.channel,
      action: { type: e.type === 'cc' ? 'master:dimmer' : 'transport:play' },
    })
  })
}

// ── GAMEPAD ───────────────────────────────────────────
function gpTriggerLabel(m: { control: string; index: number }) {
  if (m.control === 'button') return `${XBOX_BUTTON_LABELS[m.index] ?? 'Btn ' + m.index} (btn ${m.index})`
  return `${XBOX_AXIS_LABELS[m.index] ?? 'Axis ' + m.index} (axis ${m.index})`
}
function learnGamepad() {
  gpMapper.startLearning((e) => {
    gpMapper.addMapping({
      name: e.control === 'button' ? (XBOX_BUTTON_LABELS[e.index] ?? `Btn ${e.index}`) : (XBOX_AXIS_LABELS[e.index] ?? `Axis ${e.index}`),
      control: e.control,
      index: e.index,
      action: { type: 'master:dimmer' },
    })
  })
}

const pressedButtons = computed(() => gpMapper.liveButtons.value.map((v, i) => ({ i, v, on: v > 0.5 })))
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Input Mapping</DialogTitle>
      </DialogHeader>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-border">
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="tab === 'midi' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="tab = 'midi'"
        >
          MIDI
          <span class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
            :class="midiMapper.connected.value ? 'bg-green-500' : 'bg-zinc-600'" />
        </button>
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="tab === 'gamepad' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="tab = 'gamepad'"
        >
          Gamepad
          <span class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
            :class="gpMapper.connected.value ? 'bg-green-500' : 'bg-zinc-600'" />
        </button>
      </div>

      <div class="overflow-y-auto flex-1 pr-1">
        <!-- ═══════════ MIDI TAB ═══════════ -->
        <div v-if="tab === 'midi'" class="space-y-3 py-2">
          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ midiMapper.connected.value ? 'MIDI connected' : 'No MIDI device. Plug one in.' }}
            </p>
            <div class="flex gap-2">
              <button class="btn-sm" @click="midi.connect()">Reconnect</button>
              <button class="btn-sm" @click="midiMapper.loadDefaults()">Defaults</button>
              <button class="btn-sm-danger" @click="midiMapper.clearAll()">Clear</button>
            </div>
          </div>

          <button
            class="w-full py-2 rounded border-2 border-dashed text-sm font-medium transition-colors"
            :class="midiMapper.isLearning.value ? 'border-amber-500 text-amber-400 animate-pulse' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'"
            @click="midiMapper.isLearning.value ? midiMapper.cancelLearning() : learnMidi()"
          >
            {{ midiMapper.isLearning.value ? 'Press a key / move a knob… (click to cancel)' : '+ Learn MIDI control' }}
          </button>

          <div v-if="midiMapper.mappings.value.length === 0" class="text-center text-sm text-muted-foreground py-6">
            No mappings yet.
          </div>
          <div
            v-for="m in midiMapper.mappings.value"
            :key="m.id"
            class="flex flex-wrap items-center gap-2 p-2 rounded bg-card border border-border"
            :class="{ 'ring-1 ring-primary': midiMapper.lastTriggeredMappingId.value === m.id }"
          >
            <span class="font-mono text-xs w-28 shrink-0 text-amber-400">{{ midiTriggerLabel(m) }}</span>
            <select
              class="flex-1 bg-input rounded px-2 py-1 text-sm"
              :value="m.action.type"
              @change="midiMapper.updateMapping(m.id, { action: { ...m.action, type: ($event.target as HTMLSelectElement).value as InputActionType } })"
            >
              <option v-for="a in actionOptions" :key="a.type" :value="a.type">{{ a.label }}</option>
            </select>
            <select
              v-if="needsSet(m.action.type)"
              class="w-32 bg-input rounded px-2 py-1 text-sm"
              :value="m.action.setId || ''"
              @change="midiMapper.updateMapping(m.id, { action: { ...m.action, setId: ($event.target as HTMLSelectElement).value } })"
            >
              <option value="">- set -</option>
              <option v-for="s in store.sets.value" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <input
              v-if="isIndexAction(m.action.type)"
              type="number" min="1" class="w-14 bg-input rounded px-2 py-1 text-sm"
              :value="(m.action.setIndex ?? 0) + 1"
              @input="midiMapper.updateMapping(m.id, { action: { ...m.action, setIndex: Math.max(0, Number(($event.target as HTMLInputElement).value) - 1) } })"
            >
            <button class="text-red-400 hover:text-red-300 px-2" @click="midiMapper.deleteMapping(m.id)">×</button>
            <div v-if="isPadAction(m.action.type)" class="flex gap-2 w-full pl-30">
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.quantize ?? 1)"
                @change="midiMapper.updateMapping(m.id, { action: { ...m.action, quantize: parsePadQuantize(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_QUANTIZE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.releaseQuantize ?? 0.5)"
                @change="midiMapper.updateMapping(m.id, { action: { ...m.action, releaseQuantize: Number(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_RELEASE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.minHold ?? 1)"
                @change="midiMapper.updateMapping(m.id, { action: { ...m.action, minHold: Number(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_MINHOLD_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- ═══════════ GAMEPAD TAB ═══════════ -->
        <div v-else class="space-y-3 py-2">
          <GamepadLegend title="Current Xbox layout" />

          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground">
              {{ gpMapper.connected.value ? (gpMapper.devices.value[0]?.id || 'Gamepad connected') : 'No gamepad. Connect one and press a button.' }}
            </p>
            <div class="flex gap-2">
              <button class="btn-sm" @click="gpMapper.loadDefaults()">Xbox Defaults</button>
              <button class="btn-sm-danger" @click="gpMapper.clearAll()">Clear</button>
            </div>
          </div>

          <!-- live button activity -->
          <div v-if="gpMapper.connected.value" class="flex flex-wrap gap-1">
            <span
              v-for="b in pressedButtons" :key="b.i"
              class="text-[9px] font-mono px-1 py-0.5 rounded transition-colors"
              :class="b.on ? 'bg-primary text-black' : 'bg-card text-zinc-600'"
              :title="XBOX_BUTTON_LABELS[b.i] || ('btn ' + b.i)"
            >{{ XBOX_BUTTON_LABELS[b.i] || b.i }}</span>
          </div>

          <button
            class="w-full py-2 rounded border-2 border-dashed text-sm font-medium transition-colors"
            :class="gpMapper.isLearning.value ? 'border-amber-500 text-amber-400 animate-pulse' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'"
            @click="gpMapper.isLearning.value ? gpMapper.cancelLearning() : learnGamepad()"
          >
            {{ gpMapper.isLearning.value ? 'Press a button / push a stick… (click to cancel)' : '+ Learn gamepad control' }}
          </button>

          <div v-if="gpMapper.mappings.value.length === 0" class="text-center text-sm text-muted-foreground py-6">
            No mappings. Hit "Xbox Defaults".
          </div>
          <div
            v-for="m in gpMapper.mappings.value"
            :key="m.id"
            class="flex flex-wrap items-center gap-2 p-2 rounded bg-card border border-border"
            :class="{ 'ring-1 ring-primary': gpMapper.lastTriggeredMappingId.value === m.id }"
          >
            <span class="font-mono text-xs w-32 shrink-0 text-cyan-400">{{ gpTriggerLabel(m) }}</span>
            <select
              class="flex-1 bg-input rounded px-2 py-1 text-sm"
              :value="m.action.type"
              @change="gpMapper.updateMapping(m.id, { action: { ...m.action, type: ($event.target as HTMLSelectElement).value as InputActionType } })"
            >
              <option v-for="a in actionOptions" :key="a.type" :value="a.type">{{ a.label }}</option>
            </select>
            <select
              v-if="needsSet(m.action.type)"
              class="w-32 bg-input rounded px-2 py-1 text-sm"
              :value="m.action.setId || ''"
              @change="gpMapper.updateMapping(m.id, { action: { ...m.action, setId: ($event.target as HTMLSelectElement).value } })"
            >
              <option value="">- set -</option>
              <option v-for="s in store.sets.value" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <input
              v-if="isIndexAction(m.action.type)"
              type="number" min="1" class="w-14 bg-input rounded px-2 py-1 text-sm"
              :value="(m.action.setIndex ?? 0) + 1"
              @input="gpMapper.updateMapping(m.id, { action: { ...m.action, setIndex: Math.max(0, Number(($event.target as HTMLInputElement).value) - 1) } })"
            >
            <button class="text-red-400 hover:text-red-300 px-2" @click="gpMapper.deleteMapping(m.id)">×</button>
            <div v-if="isPadAction(m.action.type)" class="flex gap-2 w-full pl-34">
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.quantize ?? 1)"
                @change="gpMapper.updateMapping(m.id, { action: { ...m.action, quantize: parsePadQuantize(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_QUANTIZE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.releaseQuantize ?? 0.5)"
                @change="gpMapper.updateMapping(m.id, { action: { ...m.action, releaseQuantize: Number(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_RELEASE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <select
                class="bg-input rounded px-2 py-1 text-xs"
                :value="String(m.action.minHold ?? 1)"
                @change="gpMapper.updateMapping(m.id, { action: { ...m.action, minHold: Number(($event.target as HTMLSelectElement).value) } })"
              >
                <option v-for="o in PAD_MINHOLD_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <p class="text-[10px] text-muted-foreground pt-2">
            Tip: A = play/pause, X = activate set (output), B = beat-sync, Y = blackout,
            RT = master dimmer (rest = 100%, squeeze to dim), LT (hold) = strobe,
            bumpers + D-pad = browse the set list (preview), View = tap, Menu = trigger, L3 = stop.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.btn-sm {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
}
.btn-sm:hover { color: var(--foreground); border-color: var(--primary); }
.btn-sm-danger {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid #ef444450;
  color: #ef4444;
  cursor: pointer;
}
.btn-sm-danger:hover { background: #ef44441a; }
select { color: var(--foreground); border: 1px solid var(--border); }
</style>
