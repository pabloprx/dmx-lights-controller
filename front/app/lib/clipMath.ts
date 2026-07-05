// Pure timeline-clip geometry, extracted for unit testing without the DOM/store.
// mirrors app/composables/useClipDrag.ts:49-142

export type DragMode = 'move' | 'resize-start' | 'resize-end'

export interface ClipLike {
  id: string
  trackId: string
  startBeat: number
  duration: number
}

const EDGE_SIZE = 8 // pixels from edge to trigger resize

// ── Sub-beat grid helpers ───────────────────────────────────────────────────
// A cell at index i (0-based) maps to a 1-indexed fractional beat.
export function cellIndexToBeat(i: number, subdivision: number): number {
  const sub = Math.max(1, subdivision)
  return 1 + i / sub
}
export function beatToCellIndex(beat: number, subdivision: number): number {
  const sub = Math.max(1, subdivision)
  return Math.round((beat - 1) * sub)
}
// Snap an arbitrary beat to the nearest grid step (1/subdivision).
export function snapBeatToSubdivision(beat: number, subdivision: number): number {
  const sub = Math.max(1, subdivision)
  return Math.round(beat * sub) / sub
}

// Decide the drag mode from the cursor position within a clip element.
// `offsetX` is the cursor x relative to the clip's left edge; `width` is the clip width.
// mirrors useClipDrag.ts:99-110
export function getClipCursor(offsetX: number, width: number): DragMode {
  if (offsetX < EDGE_SIZE) {
    return 'resize-start'
  } else if (offsetX > width - EDGE_SIZE) {
    return 'resize-end'
  }
  return 'move'
}

// Check if a clip can be placed (bounds + no overlap on the same track).
// mirrors useClipDrag.ts:113-142
export function canPlaceClip(
  trackId: string,
  startBeat: number,
  duration: number,
  clips: ClipLike[],
  setLength: number,
  excludeClipId?: string,
): boolean {
  // Bounds (half-open: a clip occupies [startBeat, startBeat+duration); the last
  // playable position is setLength, so the end may reach setLength+1). Equivalent
  // to the old inclusive form for integers, but also correct for fractional clips.
  if (startBeat < 1 || startBeat + duration > setLength + 1) {
    return false
  }

  // Overlap on the same track: two half-open intervals intersect iff each starts
  // before the other ends. Touching ends (adjacency) is NOT an overlap.
  for (const clip of clips) {
    if (clip.trackId !== trackId) continue
    if (excludeClipId && clip.id === excludeClipId) continue

    if (startBeat < clip.startBeat + clip.duration && clip.startBeat < startBeat + duration) {
      return false
    }
  }

  return true
}

// Compute the clamped start/duration during a drag of the given mode.
// mirrors useClipDrag.ts:49-88 (handleMouseMove move/resize math)
export function computeClipBounds(
  mode: DragMode,
  deltaBeat: number,
  originalStartBeat: number,
  originalDuration: number,
  setLength: number,
): { startBeat: number; duration: number } {
  if (mode === 'move') {
    // Move clip - change start beat, clamp so it can't exceed set length
    const newStart = Math.max(1, originalStartBeat + deltaBeat)
    const maxStart = setLength - originalDuration + 1
    return { startBeat: Math.min(newStart, maxStart), duration: originalDuration }
  }

  if (mode === 'resize-start') {
    // Resize from start - changes both start and duration
    const maxDelta = originalDuration - 1 // Can't shrink below 1 beat
    const actualDelta = Math.min(deltaBeat, maxDelta)

    if (originalStartBeat + actualDelta >= 1) {
      return {
        startBeat: originalStartBeat + actualDelta,
        duration: originalDuration - actualDelta,
      }
    }
    // Out of bounds: no change
    return { startBeat: originalStartBeat, duration: originalDuration }
  }

  // resize-end: only changes duration
  const newDuration = Math.max(1, originalDuration + deltaBeat)
  const maxDuration = setLength - originalStartBeat + 1
  return { startBeat: originalStartBeat, duration: Math.min(newDuration, maxDuration) }
}
