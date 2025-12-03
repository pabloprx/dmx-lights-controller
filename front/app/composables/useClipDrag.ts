// Clip Drag - handles drag/drop and resize for timeline clips

import type { SetClip } from '~/types/dmx'
import { useDMXStore } from './useDMXStore'

export type DragMode = 'move' | 'resize-start' | 'resize-end'

interface DragState {
  clipId: string
  mode: DragMode
  startX: number
  originalStartBeat: number
  originalDuration: number
  beatWidth: number
}

// Singleton state
const isDragging = ref(false)
const dragState = ref<DragState | null>(null)

export function useClipDrag() {
  const store = useDMXStore()

  // Start dragging a clip
  function startDrag(
    clip: SetClip,
    mode: DragMode,
    event: MouseEvent,
    beatWidth: number
  ) {
    event.preventDefault()
    event.stopPropagation()

    isDragging.value = true
    dragState.value = {
      clipId: clip.id,
      mode,
      startX: event.clientX,
      originalStartBeat: clip.startBeat,
      originalDuration: clip.duration,
      beatWidth,
    }

    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging.value || !dragState.value) return

    const state = dragState.value
    const deltaX = event.clientX - state.startX
    const deltaBeat = Math.round(deltaX / state.beatWidth)

    const set = store.activeSet.value
    if (!set) return

    const clip = set.clips.find(c => c.id === state.clipId)
    if (!clip) return

    if (state.mode === 'move') {
      // Move clip - change start beat
      const newStart = Math.max(1, state.originalStartBeat + deltaBeat)
      // Ensure clip doesn't exceed set length
      const maxStart = set.length - clip.duration + 1
      clip.startBeat = Math.min(newStart, maxStart)
    } else if (state.mode === 'resize-start') {
      // Resize from start - changes both start and duration
      const newStart = Math.max(1, state.originalStartBeat + deltaBeat)
      const maxDelta = state.originalDuration - 1 // Can't shrink below 1 beat
      const actualDelta = Math.min(deltaBeat, maxDelta)

      if (state.originalStartBeat + actualDelta >= 1) {
        clip.startBeat = state.originalStartBeat + actualDelta
        clip.duration = state.originalDuration - actualDelta
      }
    } else if (state.mode === 'resize-end') {
      // Resize from end - only changes duration
      const newDuration = Math.max(1, state.originalDuration + deltaBeat)
      // Ensure clip doesn't exceed set length
      const maxDuration = set.length - clip.startBeat + 1
      clip.duration = Math.min(newDuration, maxDuration)
    }

    // Trigger reactivity
    store.saveToStorage()
  }

  function handleMouseUp() {
    isDragging.value = false
    dragState.value = null

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  // Get cursor style based on position within clip
  function getClipCursor(event: MouseEvent, clipElement: HTMLElement): DragMode {
    const rect = clipElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const edgeSize = 8 // pixels from edge to trigger resize

    if (x < edgeSize) {
      return 'resize-start'
    } else if (x > rect.width - edgeSize) {
      return 'resize-end'
    }
    return 'move'
  }

  // Check if clip can be placed at a position (no overlap)
  function canPlaceClip(
    trackId: string,
    startBeat: number,
    duration: number,
    excludeClipId?: string
  ): boolean {
    const set = store.activeSet.value
    if (!set) return false

    // Check bounds
    if (startBeat < 1 || startBeat + duration - 1 > set.length) {
      return false
    }

    // Check for overlaps with other clips on same track
    for (const clip of set.clips) {
      if (clip.trackId !== trackId) continue
      if (excludeClipId && clip.id === excludeClipId) continue

      const clipEnd = clip.startBeat + clip.duration - 1
      const newEnd = startBeat + duration - 1

      // Check overlap
      if (!(newEnd < clip.startBeat || startBeat > clipEnd)) {
        return false
      }
    }

    return true
  }

  return {
    isDragging: readonly(isDragging),
    dragState: readonly(dragState),
    startDrag,
    getClipCursor,
    canPlaceClip,
  }
}
