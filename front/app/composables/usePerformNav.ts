// ═══════════════════════════════════════════════════════════════
// PERFORM NAVIGATION - shared section filter + set list for the Perform view.
// Lives here (not in controller.vue) so gamepad/MIDI input can drive it:
//   D-pad Up/Down -> cycle SECTION (All / Intro / Buildup / Drop / FX ...)
//   D-pad Left/Right -> prev/next SET within the current section.
// ═══════════════════════════════════════════════════════════════

import { computed, ref } from 'vue'
import { useDMXStore } from './useDMXStore'
import { collectSetTags, filterSetsByTag, orderSectionTags } from '~/lib/setTagMath'
import { SET_SECTION_TAGS } from '~/types/dmx'

// null = "All". Singleton so every consumer (controller + input dispatcher) shares it.
const sectionFilter = ref<string | null>(null)

export function usePerformNav() {
  const store = useDMXStore()

  // Tags present in the current sets, in canonical order, with "All" (null) first.
  const sectionTags = computed(() =>
    orderSectionTags(collectSetTags(store.sets.value), SET_SECTION_TAGS),
  )
  const sections = computed<(string | null)[]>(() => [null, ...sectionTags.value])

  const visibleSets = computed(() => {
    // Guard a stale filter (tag removed/retagged) -> fall back to All.
    const tag = sectionFilter.value && sectionTags.value.includes(sectionFilter.value)
      ? sectionFilter.value
      : null
    return filterSetsByTag(store.sets.value, tag)
  })

  function setSection(tag: string | null) {
    sectionFilter.value = tag
    ensureSelectionVisible()
  }

  // Move the section filter up/down the section list (wraps).
  function cycleSection(dir: 1 | -1) {
    const secs = sections.value
    if (secs.length <= 1) return
    const idx = secs.findIndex(s => s === sectionFilter.value)
    const cur = idx < 0 ? 0 : idx
    const next = ((cur + dir) % secs.length + secs.length) % secs.length
    sectionFilter.value = secs[next] ?? null
    ensureSelectionVisible()
  }

  // After a section change, keep the previewed set inside the visible list.
  function ensureSelectionVisible() {
    const list = visibleSets.value
    if (list.length === 0) return
    const curId = store.selectedSet.value?.id
    if (!curId || !list.some(s => s.id === curId)) {
      store.selectSet(list[0]!.id)
    }
  }

  return { sectionFilter, sectionTags, sections, visibleSets, setSection, cycleSection }
}
