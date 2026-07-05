<script setup lang="ts">
// Visual Xbox-controller legend. Shows each control as a keycap glyph + the
// action it's mapped to, and lights up live when you press it. Reflects the
// user's current mappings (so it stays correct if they remap in INPUT config).
import { computed } from 'vue'
import { useGamepadMapper } from '~/composables/useGamepadMapper'
import { ACTION_CATALOG } from '~/composables/useInputActions'

withDefaults(defineProps<{ title?: string }>(), { title: 'Xbox controller' })

const gp = useGamepadMapper()

// Keycaps we surface, in a controller-ish order. face = Xbox button colour.
interface Cap { index: number; glyph: string; wide?: boolean; face?: 'green' | 'red' | 'blue' | 'yellow' }
const ROWS: Cap[][] = [
  [
    { index: 4, glyph: 'LB', wide: true }, { index: 5, glyph: 'RB', wide: true },
    { index: 6, glyph: 'LT', wide: true }, { index: 7, glyph: 'RT', wide: true },
  ],
  [
    { index: 0, glyph: 'A', face: 'green' }, { index: 1, glyph: 'B', face: 'red' },
    { index: 2, glyph: 'X', face: 'blue' }, { index: 3, glyph: 'Y', face: 'yellow' },
  ],
  [
    { index: 12, glyph: '▲' }, { index: 13, glyph: '▼' },
    { index: 14, glyph: '◀' }, { index: 15, glyph: '▶' },
  ],
]

function actionLabel(index: number): string {
  const m = gp.mappings.value.find(mm => mm.control === 'button' && mm.index === index)
  if (!m) return '—'
  const cat = ACTION_CATALOG.find(a => a.type === m.action.type)
  let label = cat?.label ?? m.action.type
  if (m.action.type === 'set:index' && typeof m.action.setIndex === 'number') label = `Set ${m.action.setIndex + 1}`
  return label
}

function isPressed(index: number): boolean {
  return (gp.liveButtons.value[index] ?? 0) > 0.5
}

const faceClass: Record<string, string> = {
  green: 'text-green-400 border-green-500/50',
  red: 'text-red-400 border-red-500/50',
  blue: 'text-sky-400 border-sky-500/50',
  yellow: 'text-amber-400 border-amber-500/50',
}

const connected = computed(() => gp.connected.value)
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-[#0e0f14]/80 p-3">
    <div class="mb-2 flex items-center justify-between">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{{ title }}</span>
      <span class="flex items-center gap-1.5 text-[10px]" :class="connected ? 'text-green-400' : 'text-neutral-500'">
        <span class="h-1.5 w-1.5 rounded-full" :class="connected ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-neutral-600'" />
        {{ connected ? 'connected' : 'not connected' }}
      </span>
    </div>

    <div class="space-y-1.5">
      <div v-for="(row, r) in ROWS" :key="r" class="grid grid-cols-2 gap-1.5">
        <div
          v-for="cap in row"
          :key="cap.index"
          class="flex items-center gap-2 rounded border bg-black/30 px-2 py-1 transition-all"
          :class="[
            isPressed(cap.index) ? 'border-white/60 bg-white/10' : 'border-white/10',
          ]"
        >
          <span
            class="flex h-6 min-w-[1.9rem] items-center justify-center rounded border px-1 font-mono text-[11px] font-bold"
            :class="[
              cap.face ? faceClass[cap.face] : 'text-neutral-200 border-white/20',
              isPressed(cap.index) ? 'bg-white/20' : 'bg-black/40',
            ]"
          >{{ cap.glyph }}</span>
          <span class="truncate text-[10px] text-neutral-300">{{ actionLabel(cap.index) }}</span>
        </div>
      </div>
    </div>

    <p class="mt-2 text-[9px] leading-snug text-neutral-500">
      Bumpers + D-pad browse the set list (preview), X activates it (output), A plays. RT = dimmer (rest 100%, squeeze to dim),
      LT (hold) = strobe, B = beat-sync, Y = blackout. Remap any of these in the INPUT panel.
    </p>
  </div>
</template>
