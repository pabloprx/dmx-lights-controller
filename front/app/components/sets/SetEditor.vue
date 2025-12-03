<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { useSetPlayer } from '~/composables/useSetPlayer'
import { TRACK_COLORS } from '~/types/dmx'

const store = useDMXStore()
const player = useSetPlayer()

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

// Get clips for a track
function getTrackClips(trackId: string) {
  if (!currentSet.value) return []
  return currentSet.value.clips.filter(c => c.trackId === trackId)
}

// Get preset color for clip display
function getClipColor(presetId: string): string {
  const preset = store.getPreset(presetId)
  if (!preset) return 'hsl(var(--muted))'

  const { red, green, blue, white } = preset.values
  const r = Math.min(255, red + white * 0.5)
  const g = Math.min(255, green + white * 0.5)
  const b = Math.min(255, blue + white * 0.5)
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

// Handle cell click (place/remove clip)
function handleCellClick(trackId: string, beat: number) {
  if (!currentSet.value || !store.selectedPresetId.value) return

  // Check if there's already a clip at this position
  const existingClip = currentSet.value.clips.find(
    c => c.trackId === trackId && beat >= c.startBeat && beat < c.startBeat + c.duration
  )

  if (existingClip) {
    // Remove existing clip
    store.deleteClip(currentSet.value.id, existingClip.id)
  } else {
    // Add new clip with selected preset
    store.addClipToSet(currentSet.value.id, trackId, store.selectedPresetId.value, beat, 1)
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
                :style="{
                  backgroundColor: getClipColor(getClipAtBeat(track.id, beat)!.presetId),
                  width: `calc(${getClipAtBeat(track.id, beat)!.duration * 100}% - 4px)`,
                }"
              >
                <span class="clip-name">
                  {{ store.getPreset(getClipAtBeat(track.id, beat)!.presetId)?.name }}
                </span>
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
    <Teleport to="body">
      <div v-if="showAddTrack" class="dialog-overlay" @click.self="showAddTrack = false">
        <div class="dialog">
          <h3 class="dialog-title">Add Track</h3>

          <div class="form-group">
            <label>Target Type</label>
            <div class="toggle-group">
              <button
                class="toggle-btn"
                :class="{ active: trackTargetType === 'device' }"
                @click="trackTargetType = 'device'; trackTargetId = ''"
              >
                Device
              </button>
              <button
                class="toggle-btn"
                :class="{ active: trackTargetType === 'group' }"
                @click="trackTargetType = 'group'; trackTargetId = ''"
              >
                Group
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>{{ trackTargetType === 'device' ? 'Select Device' : 'Select Group' }}</label>
            <div class="target-picker">
              <template v-if="trackTargetType === 'device'">
                <div
                  v-for="device in store.devices.value"
                  :key="device.id"
                  class="target-option"
                  :class="{ selected: trackTargetId === device.id }"
                  @click="trackTargetId = device.id"
                >
                  {{ device.name }}
                </div>
                <div v-if="store.devices.value.length === 0" class="empty-picker">
                  No devices. Add some in the left panel.
                </div>
              </template>
              <template v-else>
                <div
                  v-for="group in store.groups.value"
                  :key="group.id"
                  class="target-option"
                  :class="{ selected: trackTargetId === group.id }"
                  @click="trackTargetId = group.id"
                >
                  <span class="group-dot" :style="{ backgroundColor: group.color }" />
                  {{ group.name }}
                </div>
                <div v-if="store.groups.value.length === 0" class="empty-picker">
                  No groups. Add some in the left panel.
                </div>
              </template>
            </div>
          </div>

          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="showAddTrack = false">Cancel</button>
            <button
              class="btn btn-primary"
              :disabled="!trackTargetId"
              @click="handleAddTrack"
            >
              Add Track
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.set-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: hsl(var(--background));
}

/* Header */
.set-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.set-selector {
  position: relative;
}

.set-name-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  cursor: pointer;
  color: hsl(var(--foreground));
}

.set-name-button:hover {
  background: hsl(var(--accent));
}

.set-name {
  font-weight: 600;
}

.chevron {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.set-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 160px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 20;
  overflow: hidden;
}

.set-option {
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 13px;
}

.set-option:hover {
  background: hsl(var(--accent));
}

.set-option.selected {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.set-option.add-set {
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--primary));
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
  border: none;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.play-button:hover {
  background: hsl(var(--accent));
}

.play-button.playing {
  background: #22c55e;
  color: white;
}

.activate-button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.activate-button:hover:not(:disabled) {
  background: hsl(var(--accent));
}

.activate-button.active {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.activate-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.set-length {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  font-family: monospace;
}

.current-beat {
  font-size: 12px;
  color: #22c55e;
  font-family: monospace;
  font-weight: 600;
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
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.track-header-spacer {
  width: 140px;
  min-width: 140px;
  border-right: 1px solid hsl(var(--border));
}

.beat-number {
  flex: 1;
  min-width: 60px;
  padding: 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  border-right: 1px solid hsl(var(--border));
  transition: all 0.1s ease;
}

.beat-number.current-beat-indicator {
  background: #22c55e;
  color: white;
}

/* Tracks */
.tracks-container {
  flex: 1;
}

.track-row {
  display: flex;
  border-bottom: 1px solid hsl(var(--border));
  min-height: 48px;
}

.track-header {
  width: 140px;
  min-width: 140px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  border-left: 4px solid;
}

.track-name {
  font-size: 12px;
  font-weight: 500;
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
  border: none;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.track-btn:hover {
  background: hsl(var(--accent));
}

.track-btn.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.track-btn.solo.active {
  background: #eab308;
  color: #000;
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
  border-right: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: background 0.1s ease;
}

.beat-cell:hover {
  background: hsl(var(--accent) / 0.5);
}

.beat-cell.current-beat-cell {
  background: rgba(34, 197, 94, 0.15);
  box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.4);
}

.beat-cell.clip-continuation {
  pointer-events: none;
}

/* Clips */
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
}

.clip-name {
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Add Track */
.add-track-row {
  padding: 12px;
}

.add-track-button {
  width: 100%;
  padding: 12px;
  background: none;
  border: 1px dashed hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-track-button:hover {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: hsl(var(--muted-foreground));
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  max-width: 400px;
}

.dialog-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 6px;
  color: hsl(var(--muted-foreground));
}

.toggle-group {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  padding: 8px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  color: hsl(var(--foreground));
  font-size: 13px;
  cursor: pointer;
}

.toggle-btn:hover {
  background: hsl(var(--accent));
}

.toggle-btn.active {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.target-picker {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.target-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
}

.target-option:hover {
  background: hsl(var(--accent));
}

.target-option.selected {
  background: hsl(var(--primary) / 0.1);
}

.group-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.empty-picker {
  padding: 16px;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-ghost {
  background: none;
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.btn-ghost:hover {
  background: hsl(var(--accent));
}

.btn-primary {
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
