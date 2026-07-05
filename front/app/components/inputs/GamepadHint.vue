<script setup lang="ts">
// Tiny keycap badge that shows WHICH gamepad button triggers a given action,
// rendered right on the control it drives (so you learn the pad by using the UI).
// Reflects the live mapping + lights up while the button is held.
import { computed } from 'vue'
import { useGamepadMapper } from '~/composables/useGamepadMapper'
import type { InputActionType } from '~/composables/useInputActions'

const props = defineProps<{ action: InputActionType; setIndex?: number }>()
const gp = useGamepadMapper()

const GLYPH: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3', 12: '▲', 13: '▼', 14: '◀', 15: '▶', 16: '⊕', 17: 'Sh',
}

const mapping = computed(() =>
  gp.mappings.value.find(m =>
    m.control === 'button' &&
    m.action.type === props.action &&
    (props.action !== 'set:index' || m.action.setIndex === props.setIndex),
  ),
)
const glyph = computed(() => (mapping.value ? (GLYPH[mapping.value.index] ?? `#${mapping.value.index}`) : null))
const pressed = computed(() => (mapping.value ? (gp.liveButtons.value[mapping.value.index] ?? 0) > 0.5 : false))
</script>

<template>
  <span
    v-if="glyph"
    class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded border px-1 font-mono text-[9px] font-bold leading-none transition-colors"
    :class="pressed ? 'border-white/70 bg-white/25 text-white' : 'border-white/25 bg-black/40 text-neutral-300'"
    :title="`Gamepad: ${glyph}`"
  >{{ glyph }}</span>
</template>
