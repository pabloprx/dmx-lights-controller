<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { useSetPlayer } from '~/composables/useSetPlayer'
import { useClipDrag } from '~/composables/useClipDrag'
import { TRACK_COLORS, getPresetDisplayColor, getProfileById } from '~/types/dmx'
import type { SetClip, Preset } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import PresetEditorModal from '~/components/presets/PresetEditorModal.vue'

const store = useDMXStore()
const player = useSetPlayer()
const clipDrag = useClipDrag()

// Beat cell width for drag calculations
const BEAT_WIDTH = 60

// Create first set if none exists
onMounted(() => {
  if (store.sets.value.length === 0) {
    store.addSet({ name: 'Set 1' })
    store.selectSet(store.sets.value[0].id)
  } else if (!store.selectedSetId.value) {
    store.selectSet(store.sets.value[0].id)
  }
})

const currentSet = computed(() => store.selectedSet.value)

// Set selector
const showSetSelector = ref(false)

function createNewSet() {
  const newSet = store.addSet({ name: `Set ${store.sets.value.length + 1}` })
  store.selectSet(newSet.id)
  showSetSelector.value = false
}

// Beat display
const beatColumns = computed(() => {
  if (!currentSet.value) return []
  return Array.from({ length: currentSet.value.length }, (_, i) => i + 1)
})

// Add track dialog
const showAddTrack = ref(false)
const trackTargetType = ref<'device' | 'group'>('device')
const trackTargetId = ref('')

function handleAddTrack() {
  if (!trackTargetId.value || !currentSet.value) return

  store.addTrackToSet(currentSet.value.id, trackTargetType.value, trackTargetId.value)
  trackTargetId.value = ''
  showAddTrack.value = false
}

// Save Scene dialog
const showSaveScene = ref(false)
const newSceneName = ref('')

function handleSaveAsScene() {
  if (!currentSet.value || !newSceneName.value.trim()) return

  store.saveSetAsScene(currentSet.value.id, newSceneName.value.trim())
  newSceneName.value = ''
  showSaveScene.value = false
}

// Load Scene dialog
const showLoadScene = ref(false)
const selectedSceneToLoad = ref<string | null>(null)

function handleLoadScene() {
  if (!currentSet.value || !selectedSceneToLoad.value) return

  store.loadSceneToSet(currentSet.value.id, selectedSceneToLoad.value)
  selectedSceneToLoad.value = null
  showLoadScene.value = false
}

// ═══════════════════════════════════════════════════════════════
// PRESET EDITOR MODAL
// ═══════════════════════════════════════════════════════════════
const showPresetEditor = ref(false)
const presetEditorDeviceId = ref<string>('')
const presetEditorBeat = ref<number>(1)
const presetEditorTrackId = ref<string>('')
const presetEditorExistingPreset = ref<Preset | null>(null)

// Get target device for a track (for preview)
function getTrackTargetDeviceId(trackId: string): string | null {
  if (!currentSet.value) return null
  const track = currentSet.value.tracks.find(t => t.id === trackId)
  if (!track) return null

  if (track.targetType === 'device') {
    return track.targetId
  } else {
    // Group: return first device
    const group = store.getGroup(track.targetId)
    return group?.deviceIds[0] || null
  }
}

function openPresetEditor(trackId: string, beat: number, existingPreset: Preset | null = null) {
  const deviceId = getTrackTargetDeviceId(trackId)
  if (!deviceId) return

  presetEditorDeviceId.value = deviceId
  presetEditorBeat.value = beat
  presetEditorTrackId.value = trackId
  presetEditorExistingPreset.value = existingPreset
  showPresetEditor.value = true
}

function handlePresetSave(presetData: Omit<Preset, 'id'>) {
  if (!currentSet.value) return

  // Add preset to library
  const newPreset = store.addPreset(presetData)

  // Add clip at the beat
  store.addClipToSet(
    currentSet.value.id,
    presetEditorTrackId.value,
    newPreset.id,
    presetEditorBeat.value,
    1
  )

  showPresetEditor.value = false
}

function handlePresetDiscard() {
  showPresetEditor.value = false
}

// Get clips for a track
function getTrackClips(trackId: string) {
  if (!currentSet.value) return []
  return currentSet.value.clips.filter(c => c.trackId === trackId)
}

// Get preset color for clip display
function getClipColor(presetId: string): string {
  const preset = store.getPreset(presetId)
  if (!preset) return 'hsl(var(--muted))'

  // Use the new helper that handles both RGBW and slider profiles
  return getPresetDisplayColor(preset)
}

// Handle cell click (place/remove clip or open editor)
function handleCellClick(trackId: string, beat: number) {
  if (!currentSet.value) return

  // Check if there's already a clip at this position
  const existingClip = currentSet.value.clips.find(
    c => c.trackId === trackId && beat >= c.startBeat && beat < c.startBeat + c.duration
  )

  if (existingClip) {
    // Existing clip: remove it (double-click to edit could be added later)
    store.deleteClip(currentSet.value.id, existingClip.id)
  } else {
    // No clip: check if we have a selected preset, otherwise open editor
    if (store.selectedPresetId.value) {
      // If preset is selected AND matches the track's profile, use it directly
      const preset = store.getPreset(store.selectedPresetId.value)
      const deviceId = getTrackTargetDeviceId(trackId)
      const device = deviceId ? store.getDevice(deviceId) : null

      if (preset && device && preset.profileId === device.profileId) {
        // Selected preset matches track profile - use it
        store.addClipToSet(currentSet.value.id, trackId, store.selectedPresetId.value, beat, 1)
        return
      }
    }

    // No matching preset selected - open the editor modal
    openPresetEditor(trackId, beat)
  }
}

// Get clip at specific beat
function getClipAtBeat(trackId: string, beat: number) {
  if (!currentSet.value) return null
  return currentSet.value.clips.find(
    c => c.trackId === trackId && c.startBeat === beat
  )
}

// Check if beat is covered by a clip (not start, but continuation)
function isBeatCovered(trackId: string, beat: number) {
  if (!currentSet.value) return false
  return currentSet.value.clips.some(
    c => c.trackId === trackId && beat > c.startBeat && beat < c.startBeat + c.duration
  )
}

// Handle clip mousedown for drag
function handleClipMouseDown(event: MouseEvent, clip: SetClip) {
  const target = event.currentTarget as HTMLElement
  const mode = clipDrag.getClipCursor(event, target)
  clipDrag.startDrag(clip, mode, event, BEAT_WIDTH)
}

// Get cursor style for clip
function getClipCursorStyle(clip: SetClip) {
  if (clipDrag.isDragging.value && clipDrag.dragState.value?.clipId === clip.id) {
    const mode = clipDrag.dragState.value.mode
    if (mode === 'resize-start' || mode === 'resize-end') {
      return 'ew-resize'
    }
    return 'grabbing'
  }
  return 'grab'
}

// Handle clip mousemove for cursor preview
function handleClipMouseMove(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const mode = clipDrag.getClipCursor(event, target)
  if (mode === 'resize-start' || mode === 'resize-end') {
    target.style.cursor = 'ew-resize'
  } else {
    target.style.cursor = 'grab'
  }
}
</script>

<template>
  <div class="set-editor">
    <!-- Set Header -->
    <div class="set-header">
      <div class="set-selector">
        <button class="set-name-button" @click="showSetSelector = !showSetSelector">
          <span class="set-name">{{ currentSet?.name || 'Select Set' }}</span>
          <span class="chevron">▼</span>
        </button>

        <div v-if="showSetSelector" class="set-dropdown">
          <button
            v-for="set in store.sets.value"
            :key="set.id"
            class="set-option"
            :class="{ selected: store.selectedSetId.value === set.id }"
            @click="store.selectSet(set.id); showSetSelector = false"
          >
            {{ set.name }}
          </button>
          <button class="set-option add-set" @click="createNewSet">
            + New Set
          </button>
        </div>
      </div>

      <div class="set-controls">
        <!-- Play/Stop Button -->
        <button
          class="play-button"
          :class="{ playing: player.isPlaying.value }"
          @click="player.isPlaying.value ? player.stop() : player.play()"
        >
          {{ player.isPlaying.value ? '⏹' : '▶' }}
        </button>

        <!-- Set as Active -->
        <button
          class="activate-button"
          :class="{ active: store.activeSetId.value === currentSet?.id }"
          :disabled="!currentSet"
          @click="player.setActiveSet(currentSet?.id || null)"
        >
          {{ store.activeSetId.value === currentSet?.id ? 'Active' : 'Set Active' }}
        </button>

        <span class="divider" />

        <!-- Scene buttons -->
        <button
          class="scene-button"
          :disabled="!currentSet || currentSet.tracks.length === 0"
          @click="showSaveScene = true"
        >
          💾 Save Scene
        </button>
        <button
          class="scene-button"
          :disabled="!currentSet || store.scenes.value.length === 0"
          @click="showLoadScene = true"
        >
          📂 Load Scene
        </button>

        <span class="divider" />

        <span class="set-length">{{ currentSet?.length || 8 }} beats</span>
        <span class="current-beat">Beat: {{ player.beatInSet.value }}</span>
      </div>
    </div>

    <!-- Timeline Grid -->
    <div v-if="currentSet" class="timeline-container">
      <!-- Beat Ruler -->
      <div class="beat-ruler">
        <div class="track-header-spacer" />
        <div
          v-for="beat in beatColumns"
          :key="beat"
          class="beat-number"
          :class="{ 'current-beat-indicator': player.beatInSet.value === beat && player.isPlaying.value }"
        >
          {{ beat }}
        </div>
      </div>

      <!-- Tracks -->
      <div class="tracks-container">
        <div
          v-for="track in currentSet.tracks"
          :key="track.id"
          class="track-row"
        >
          <!-- Track Header -->
          <div class="track-header" :style="{ borderLeftColor: track.color }">
            <span class="track-name">{{ track.name }}</span>
            <div class="track-controls">
              <button
                class="track-btn"
                :class="{ active: track.muted }"
                title="Mute"
                @click="store.updateTrack(currentSet.id, track.id, { muted: !track.muted })"
              >
                M
              </button>
              <button
                class="track-btn solo"
                :class="{ active: track.solo }"
                title="Solo"
                @click="store.updateTrack(currentSet.id, track.id, { solo: !track.solo })"
              >
                S
              </button>
            </div>
          </div>

          <!-- Beat Cells -->
          <div class="beat-cells">
            <div
              v-for="beat in beatColumns"
              :key="beat"
              class="beat-cell"
              :class="{
                'has-clip': getClipAtBeat(track.id, beat),
                'clip-continuation': isBeatCovered(track.id, beat),
                'current-beat-cell': player.beatInSet.value === beat && player.isPlaying.value,
              }"
              @click="handleCellClick(track.id, beat)"
            >
              <div
                v-if="getClipAtBeat(track.id, beat)"
                class="clip"
                :class="{ dragging: clipDrag.isDragging.value && clipDrag.dragState.value?.clipId === getClipAtBeat(track.id, beat)!.id }"
                :style="{
                  backgroundColor: getClipColor(getClipAtBeat(track.id, beat)!.presetId),
                  width: `calc(${getClipAtBeat(track.id, beat)!.duration * 100}% - 4px)`,
                  cursor: getClipCursorStyle(getClipAtBeat(track.id, beat)!),
                }"
                @mousedown.stop="handleClipMouseDown($event, getClipAtBeat(track.id, beat)!)"
                @mousemove="handleClipMouseMove($event)"
              >
                <span class="clip-name">
                  {{ store.getPreset(getClipAtBeat(track.id, beat)!.presetId)?.name }}
                </span>
                <!-- Resize handles -->
                <div class="resize-handle resize-handle-start" />
                <div class="resize-handle resize-handle-end" />
              </div>
            </div>
          </div>
        </div>

        <!-- Add Track Row -->
        <div class="add-track-row">
          <button class="add-track-button" @click="showAddTrack = true">
            + Add Track
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>No set selected</p>
      <button class="btn btn-primary" @click="createNewSet">Create Set</button>
    </div>

    <!-- Add Track Dialog -->
    <Dialog :open="showAddTrack" @update:open="showAddTrack = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Track</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>Target Type</Label>
            <div class="flex gap-2">
              <button
                class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all border"
                :class="trackTargetType === 'device'
                  ? 'bg-green-500/20 text-green-400 border-green-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'"
                @click="trackTargetType = 'device'; trackTargetId = ''"
              >
                Device
              </button>
              <button
                class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all border"
                :class="trackTargetType === 'group'
                  ? 'bg-green-500/20 text-green-400 border-green-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'"
                @click="trackTargetType = 'group'; trackTargetId = ''"
              >
                Group
              </button>
            </div>
          </div>

          <div class="grid gap-2">
            <Label>{{ trackTargetType === 'device' ? 'Select Device' : 'Select Group' }}</Label>
            <div class="max-h-48 overflow-y-auto border border-zinc-700 rounded-lg bg-zinc-900">
              <template v-if="trackTargetType === 'device'">
                <div
                  v-for="device in store.devices.value"
                  :key="device.id"
                  class="flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm transition-colors"
                  :class="trackTargetId === device.id
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-zinc-300 hover:bg-zinc-800'"
                  @click="trackTargetId = device.id"
                >
                  {{ device.name }}
                </div>
                <div v-if="store.devices.value.length === 0" class="p-4 text-center text-zinc-500 text-xs">
                  No devices. Add some in the left panel.
                </div>
              </template>
              <template v-else>
                <div
                  v-for="group in store.groups.value"
                  :key="group.id"
                  class="flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm transition-colors"
                  :class="trackTargetId === group.id
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-zinc-300 hover:bg-zinc-800'"
                  @click="trackTargetId = group.id"
                >
                  <span class="w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: group.color }" />
                  {{ group.name }}
                </div>
                <div v-if="store.groups.value.length === 0" class="p-4 text-center text-zinc-500 text-xs">
                  No groups. Add some in the left panel.
                </div>
              </template>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAddTrack = false">Cancel</Button>
          <Button :disabled="!trackTargetId" @click="handleAddTrack">Add Track</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Save Scene Dialog -->
    <Dialog :open="showSaveScene" @update:open="showSaveScene = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Scene</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <p class="scene-info">
            Saves current tracks ({{ currentSet?.tracks.length || 0 }}) and clips ({{ currentSet?.clips.length || 0 }})
            as a reusable blueprint.
          </p>
          <div class="grid gap-2">
            <Label for="scene-name">Scene Name</Label>
            <Input
              id="scene-name"
              v-model="newSceneName"
              placeholder="e.g. Left-Right Strobe"
              @keyup.enter="handleSaveAsScene"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showSaveScene = false">Cancel</Button>
          <Button :disabled="!newSceneName.trim()" @click="handleSaveAsScene">Save Scene</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Load Scene Dialog -->
    <Dialog :open="showLoadScene" @update:open="showLoadScene = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load Scene</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <p class="scene-warning">
            ⚠️ This will replace all tracks and clips in the current Set.
          </p>
          <div class="grid gap-2">
            <Label>Select Scene</Label>
            <div class="scene-picker">
              <div
                v-for="scene in store.scenes.value"
                :key="scene.id"
                class="scene-option"
                :class="{ selected: selectedSceneToLoad === scene.id }"
                @click="selectedSceneToLoad = scene.id"
              >
                <span class="scene-option-name">{{ scene.name }}</span>
                <span class="scene-option-info">{{ scene.tracks.length }} tracks · {{ scene.clips.length }} clips</span>
              </div>
              <div v-if="store.scenes.value.length === 0" class="empty-picker">
                No scenes saved yet.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showLoadScene = false">Cancel</Button>
          <Button :disabled="!selectedSceneToLoad" @click="handleLoadScene">Load Scene</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Preset Editor Modal -->
    <PresetEditorModal
      :open="showPresetEditor"
      :device-id="presetEditorDeviceId"
      :preset="presetEditorExistingPreset"
      :beat="presetEditorBeat"
      @update:open="showPresetEditor = $event"
      @save="handlePresetSave"
      @discard="handlePresetDiscard"
    />
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   NEON STUDIO - Set Editor / Timeline
   ═══════════════════════════════════════════════════════════ */

.set-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1b21;
}

/* Header */
.set-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #22c55e20;
  background: #22232b;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.set-selector {
  position: relative;
}

.set-name-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #2a2b35;
  border: 1px solid #383944;
  border-radius: 6px;
  cursor: pointer;
  color: #f0f0f5;
  transition: all 0.2s ease;
}

.set-name-button:hover {
  background: #22c55e10;
  border-color: #22c55e40;
}

.set-name {
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.chevron {
  font-size: 10px;
  color: #8888a0;
}

.set-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 160px;
  background: #2a2b35;
  border: 1px solid #383944;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px #22c55e10;
  z-index: 20;
  overflow: hidden;
}

.set-option {
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  color: #f0f0f5;
  cursor: pointer;
  font-size: 13px;
}

.set-option:hover {
  background: #22c55e15;
}

.set-option.selected {
  background: #22c55e20;
  color: #22c55e;
}

.set-option.add-set {
  border-top: 1px solid #2a2b36;
  color: #22c55e;
}

.set-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #2a2b36;
  background: #1a1b24;
  color: #f0f0f5;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.play-button:hover {
  background: #22c55e20;
  border-color: #22c55e40;
}

.play-button.playing {
  background: #22c55e;
  border-color: #22c55e;
  color: #0a0a0f;
  box-shadow: 0 0 20px #22c55e60, 0 0 40px #22c55e30;
}

.activate-button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #2a2b36;
  background: #1a1b24;
  color: #8888a0;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.activate-button:hover:not(:disabled) {
  background: #22c55e10;
  border-color: #22c55e40;
  color: #f0f0f5;
}

.activate-button.active {
  background: #22c55e20;
  border-color: #22c55e;
  color: #22c55e;
  box-shadow: 0 0 15px #22c55e30;
}

.activate-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.set-length {
  font-size: 12px;
  color: #8888a0;
  font-family: 'JetBrains Mono', monospace;
}

.current-beat {
  font-size: 12px;
  color: #22c55e;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  text-shadow: 0 0 10px #22c55e60;
}

/* Timeline */
.timeline-container {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* Beat Ruler */
.beat-ruler {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: #22232b;
  border-bottom: 1px solid #22c55e20;
}

.track-header-spacer {
  width: 140px;
  min-width: 140px;
  border-right: 1px solid #383944;
  background: #22232b;
}

.beat-number {
  flex: 1;
  min-width: 60px;
  padding: 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: #8888a0;
  border-right: 1px solid #2a2b36;
  transition: all 0.15s ease;
}

/* Zebra striping for beat numbers */
.beat-number:nth-child(odd) {
  background: #22c55e08;
}

.beat-number:nth-child(even) {
  background: #22232b;
}

.beat-number.current-beat-indicator {
  background: #22c55e;
  color: #0a0a0f;
  box-shadow: 0 0 15px #22c55e50;
}

/* Tracks */
.tracks-container {
  flex: 1;
}

.track-row {
  display: flex;
  border-bottom: 1px solid #2a2b36;
  min-height: 52px;
}

/* Zebra striping for track rows */
.track-row:nth-child(odd) {
  background: #1a1b21;
}

.track-row:nth-child(even) {
  background: #1f2027;
}

.track-header {
  width: 140px;
  min-width: 140px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #22232b;
  border-right: 1px solid #383944;
  border-left: 4px solid;
}

.track-name {
  font-size: 12px;
  font-weight: 500;
  color: #f0f0f5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-controls {
  display: flex;
  gap: 4px;
}

.track-btn {
  width: 20px;
  height: 20px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  border: 1px solid #2a2b36;
  background: #1a1b24;
  color: #8888a0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.track-btn:hover {
  background: #22c55e15;
  border-color: #22c55e40;
}

.track-btn.active {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
  box-shadow: 0 0 10px #ef444450;
}

.track-btn.solo.active {
  background: #eab308;
  border-color: #eab308;
  color: #000;
  box-shadow: 0 0 10px #eab30850;
}

/* Beat Cells */
.beat-cells {
  flex: 1;
  display: flex;
}

.beat-cell {
  flex: 1;
  min-width: 60px;
  position: relative;
  border-right: 1px solid #2a2b36;
  cursor: pointer;
  transition: background 0.15s ease;
}

/* Zebra striping for beat cells - matches beat ruler */
.beat-cell:nth-child(odd) {
  background: #22c55e05;
}

.beat-cell:nth-child(even) {
  background: transparent;
}

.beat-cell:hover {
  background: #22c55e15;
}

.beat-cell.current-beat-cell {
  background: #22c55e20;
  box-shadow: inset 0 0 0 1px #22c55e40, inset 0 0 20px #22c55e15;
}

.beat-cell.clip-continuation {
  pointer-events: none;
}

/* Clips - GLOWING LIGHT BLOCKS */
.clip {
  position: absolute;
  top: 4px;
  left: 2px;
  bottom: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  overflow: hidden;
  z-index: 5;
  transition: transform 0.05s ease, box-shadow 0.15s ease;
  user-select: none;
  /* Gradient overlay for depth */
  background-image: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.2) 100%);
  background-blend-mode: overlay;
}

.clip:hover {
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    0 0 20px var(--clip-glow, rgba(255,255,255,0.2));
  transform: translateY(-1px);
}

.clip.dragging {
  transform: scale(1.03) translateY(-2px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.5),
    0 0 30px var(--clip-glow, rgba(255,255,255,0.3));
  z-index: 10;
}

.clip-name {
  font-size: 9px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  transition: background 0.15s ease;
}

.resize-handle-start {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.resize-handle-end {
  right: 0;
  border-radius: 0 4px 4px 0;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Add Track */
.add-track-row {
  padding: 12px;
}

.add-track-button {
  width: 100%;
  padding: 12px;
  background: none;
  border: 1px dashed #2a2b36;
  border-radius: 6px;
  color: #8888a0;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-track-button:hover {
  border-color: #22c55e50;
  color: #22c55e;
  background: #22c55e08;
  box-shadow: 0 0 20px #22c55e10;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #8888a0;
}

.empty-state .btn {
  padding: 10px 20px;
  background: #22c55e20;
  border: 1px solid #22c55e;
  border-radius: 6px;
  color: #22c55e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.empty-state .btn:hover {
  background: #22c55e;
  color: #0a0a0f;
  box-shadow: 0 0 20px #22c55e50;
}

/* Scene controls */
.divider {
  width: 1px;
  height: 20px;
  background: #2a2b36;
}

.scene-button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #2a2b36;
  background: #1a1b24;
  color: #f0f0f5;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scene-button:hover:not(:disabled) {
  background: #22c55e15;
  border-color: #22c55e40;
  color: #22c55e;
}

.scene-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Scene dialog styles */
.scene-info {
  font-size: 13px;
  color: #8888a0;
  margin: 0;
}

.scene-warning {
  font-size: 13px;
  color: #eab308;
  margin: 0;
  padding: 8px 12px;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 6px;
}

.scene-picker {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #383944;
  border-radius: 6px;
  background: #22232b;
}

.scene-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid #2a2b36;
  transition: all 0.15s ease;
}

.scene-option:last-child {
  border-bottom: none;
}

.scene-option:hover {
  background: #1a1b24;
}

.scene-option.selected {
  background: #22c55e15;
  border-left: 2px solid #22c55e;
  padding-left: 10px;
}

.scene-option-name {
  font-size: 13px;
  font-weight: 500;
  color: #f0f0f5;
}

.scene-option.selected .scene-option-name {
  color: #22c55e;
}

.scene-option-info {
  font-size: 11px;
  color: #8888a0;
  font-family: 'JetBrains Mono', monospace;
}

.empty-picker {
  padding: 24px;
  text-align: center;
  color: #555566;
  font-size: 13px;
}
</style>
