<script setup lang="ts">
import TransportBar from '~/components/transport/TransportBar.vue'
import AppLayout from '~/components/layout/AppLayout.vue'
import LeftPanel from '~/components/layout/LeftPanel.vue'
import RightPanel from '~/components/layout/RightPanel.vue'
import SetEditor from '~/components/sets/SetEditor.vue'
import StageVisualizer from '~/components/visualizer/StageVisualizer.vue'
import GamepadLegend from '~/components/inputs/GamepadLegend.vue'
import GamepadHint from '~/components/inputs/GamepadHint.vue'
import { useDMXStore } from '~/composables/useDMXStore'
import { useSetPlayer } from '~/composables/useSetPlayer'
import { usePerformNav } from '~/composables/usePerformNav'
import { getPreviewColor } from '~/types/dmx'

const { isPerformanceMode } = useAppMode()
const store = useDMXStore()
const player = useSetPlayer()
const performNav = usePerformNav()

// Workspace tabs
type Tab = 'compose' | 'perform' | 'stage'
const activeTab = ref<Tab>('compose')

// Panel collapse state (compose)
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)
// Live 3D dock in compose (on by default so you always see the stage render)
const showComposeDock = ref(true)

watch(isPerformanceMode, (isPerf) => {
  if (isPerf) {
    leftPanelCollapsed.value = true
    activeTab.value = 'perform'
  }
})

// Perform flow: SELECT = preview (what RB/LB points at), ACTIVATE = output
// (push it to the live 3D), PLAY = run it. These are deliberately separate.
function selectPreview(setId: string) {
  store.selectSet(setId)
}
function activateOutput(setId: string) {
  store.selectSet(setId)
  player.setActiveSet(setId)
  // Push the active set's current-beat frame so the 3D shows the output even
  // when paused (render seam works with no hardware attached).
  if (!player.isPlaying.value) player.updateDMX()
}
function activateAndPlay(setId: string) {
  activateOutput(setId)
  if (!player.isPlaying.value) player.play()
}

// Load the curated VJ pack (6 sets) bound to the user's pinspots.
function loadVjPack() {
  const res = store.loadVjPack()
  if (!res.ok) {
    window.alert('Add at least one PinSpot fixture first (Stage tab), then load the VJ pack.')
  }
}

// Perform section filter (shared with gamepad/MIDI via usePerformNav).
// D-pad Up/Down cycles these sections; Left/Right scrolls sets within one.
const tagFilter = performNav.sectionFilter
const allSetTags = performNav.sectionTags
const visibleSets = performNav.visibleSets
function setSection(tag: string | null) {
  performNav.setSection(tag)
}

function getSetClipColors(set: typeof store.sets.value[0]) {
  const colors: string[] = []
  for (const clip of set.clips.slice(0, 8)) {
    const preset = store.getPreset(clip.presetId)
    if (preset?.values) colors.push(getPreviewColor(preset.values))
  }
  return colors
}

const beatProgress = computed(() => {
  const set = store.activeSet.value
  if (!set) return 0
  return ((player.beatInSet.value - 1) / set.length) * 100
})
</script>

<template>
  <div class="controller-page">
    <TransportBar />

    <!-- Tab Bar -->
    <div class="tab-bar">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'compose' }" @click="activeTab = 'compose'">
          <span class="tab-icon">✎</span> Compose
        </button>
        <button class="tab" :class="{ active: activeTab === 'perform' }" @click="activeTab = 'perform'">
          <span class="tab-icon">▶</span> Perform
        </button>
        <button class="tab" :class="{ active: activeTab === 'stage' }" @click="activeTab = 'stage'">
          <span class="tab-icon">◈</span> Stage 3D
        </button>
      </div>

      <div class="tab-bar-right">
        <div v-if="isPerformanceMode" class="mode-indicator">
          <div class="live-dot" /><span>LIVE</span>
        </div>
        <NuxtLink to="/diagnostics" class="diag-link" title="Diagnostics & hardware">Diagnostics</NuxtLink>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-area">
      <!-- Compose -->
      <div v-show="activeTab === 'compose'" class="compose-wrap">
        <AppLayout
          v-model:left-panel-collapsed="leftPanelCollapsed"
          v-model:right-panel-collapsed="rightPanelCollapsed"
          class="compose-layout"
        >
          <template #left><LeftPanel /></template>
          <SetEditor />
          <template #right><RightPanel /></template>
        </AppLayout>

        <!-- Live 3D dock (only while on Compose: avoids two concurrent WebGL/rAF
             loops when Perform/Stage mount their own StageVisualizer) -->
        <div v-if="showComposeDock && activeTab === 'compose'" class="compose-dock">
          <StageVisualizer mode="view" class="dock-viz" />
        </div>
        <button class="dock-toggle" @click="showComposeDock = !showComposeDock">
          {{ showComposeDock ? '▾ Hide 3D' : '▸ Show 3D preview' }}
        </button>
      </div>

      <!-- Perform -->
      <div v-show="activeTab === 'perform'" class="perform-view">
        <div class="perform-stage">
          <StageVisualizer v-if="activeTab === 'perform'" mode="view" class="perform-viz" />
          <div class="perform-corner">OUTPUT · live 3D</div>
          <div class="perform-overlay">
            <div v-if="store.activeSet.value" class="now-playing-mini">
              <span class="np-label">OUTPUT</span>
              <span class="np-name">{{ store.activeSet.value.name }}</span>
              <span class="np-beat">{{ player.beatInSet.value }} / {{ store.activeSet.value.length }}</span>
              <span v-if="player.reverseActive.value" class="np-reverse">◀◀ REVERSE</span>
              <button class="np-play" :class="{ playing: player.isPlaying.value }"
                @click="player.isPlaying.value ? player.stop() : player.play()">
                {{ player.isPlaying.value ? '⏹' : '▶' }}
              </button>
              <GamepadHint action="transport:play" />
            </div>
            <div v-else class="now-playing-mini">
              <span class="np-label">OUTPUT</span>
              <span class="np-name" style="opacity:.6">nothing active</span>
            </div>
          </div>
        </div>

        <div class="perform-content">
          <div class="perform-main">
            <!-- Control hints strip -->
            <div class="perform-hints">
              <span class="ph-item"><GamepadHint action="set:prev" /><GamepadHint action="set:next" /> set</span>
              <span class="ph-item"><GamepadHint action="set:section-prev" /><GamepadHint action="set:section-next" /> section</span>
              <span class="ph-item"><GamepadHint action="set:activate" /> activate (output)</span>
              <span class="ph-item"><GamepadHint action="transport:play" /> play</span>
              <span class="ph-item"><GamepadHint action="transport:beat-sync" /> beat-sync</span>
              <span class="ph-item"><GamepadHint action="playback:reverse-hold" /> reverse</span>
              <span class="ph-item"><GamepadHint action="master:blackout" /> blackout</span>
            </div>

            <!-- Section filter chips (D-pad Up/Down) + VJ pack loader -->
            <div class="tag-filter-row">
              <template v-if="allSetTags.length">
                <span class="tf-nav-hint"><GamepadHint action="set:section-prev" />/<GamepadHint action="set:section-next" /></span>
                <button class="tf-chip" :class="{ active: tagFilter === null }" @click="setSection(null)">All</button>
                <button
                  v-for="t in allSetTags"
                  :key="t"
                  class="tf-chip"
                  :class="{ active: tagFilter === t }"
                  @click="setSection(t)"
                >{{ t }}</button>
              </template>
              <button class="tf-chip vj" @click="loadVjPack">✨ Load VJ Pack</button>
            </div>

            <div class="set-grid">
              <div
                v-for="set in visibleSets"
                :key="set.id"
                class="set-button"
                :class="{
                  active: store.activeSetId.value === set.id,
                  selected: store.selectedSetId.value === set.id,
                  playing: store.activeSetId.value === set.id && player.isPlaying.value,
                }"
                @click="selectPreview(set.id)"
              >
                <div class="set-card-top">
                  <div class="set-name">{{ set.name }}</div>
                  <span v-if="store.activeSetId.value === set.id" class="set-tag live">LIVE</span>
                  <span v-else-if="store.selectedSetId.value === set.id" class="set-tag preview">PREVIEW</span>
                </div>
                <div class="set-info">
                  {{ set.length }} beats<span v-if="(set.subdivision ?? 1) > 1"> · {{ set.subdivision }}x</span> · {{ set.clips.length }} clips
                </div>
                <div v-if="(set.tags ?? []).length" class="set-card-tags">
                  <span v-for="t in set.tags" :key="t" class="set-card-tag">{{ t }}</span>
                </div>
                <div class="set-colors">
                  <span v-for="(color, idx) in getSetClipColors(set)" :key="idx" class="color-dot" :style="{ backgroundColor: color }" />
                </div>

                <!-- Actions: only on the selected/active card to keep it clean -->
                <div v-if="store.selectedSetId.value === set.id || store.activeSetId.value === set.id" class="set-actions">
                  <button class="sa-btn activate" :class="{ on: store.activeSetId.value === set.id }"
                    @click.stop="activateOutput(set.id)">
                    {{ store.activeSetId.value === set.id ? 'Active' : 'Activate' }} <GamepadHint action="set:activate" />
                  </button>
                  <button class="sa-btn play"
                    @click.stop="store.activeSetId.value === set.id && player.isPlaying.value ? player.stop() : activateAndPlay(set.id)">
                    {{ store.activeSetId.value === set.id && player.isPlaying.value ? 'Stop' : 'Play' }} <GamepadHint action="transport:play" />
                  </button>
                </div>

                <div v-if="store.activeSetId.value === set.id && player.isPlaying.value" class="set-beat-indicator">
                  <div class="beat-fill" :style="{ width: beatProgress + '%' }" />
                </div>
              </div>
            </div>
            <div v-if="store.sets.value.length === 0" class="empty-state">
              <p>No Sets yet</p>
              <p class="hint">Switch to Compose to build one, or</p>
              <button class="hint-btn" @click="loadVjPack">✨ Load VJ Pack (6 curated sets)</button>
            </div>
            <div v-else-if="visibleSets.length === 0" class="empty-state">
              <p>No sets tagged "{{ tagFilter }}"</p>
              <button class="hint-btn" @click="tagFilter = null">Show all</button>
            </div>
          </div>

          <aside class="perform-aside">
            <GamepadLegend />
          </aside>
        </div>
      </div>

      <!-- Stage 3D (practice / position rig) -->
      <div v-show="activeTab === 'stage'" class="stage-view">
        <StageVisualizer v-if="activeTab === 'stage'" mode="edit" class="stage-viz" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.controller-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--background);
  color: var(--foreground);
}

.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
}
.tabs { display: flex; }
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab:hover { color: var(--foreground); background: var(--accent); }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.tab-icon { font-size: 11px; }

.tab-bar-right { display: flex; align-items: center; gap: 14px; }
.diag-link {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
  text-decoration: none;
}
.diag-link:hover { color: var(--primary); }

.mode-indicator { display: flex; align-items: center; gap: 6px; color: #ef4444; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.main-area { flex: 1; overflow: hidden; min-height: 0; }

/* Compose */
.compose-wrap { height: 100%; display: flex; flex-direction: column; position: relative; }
.compose-layout { flex: 1; min-height: 0; }
.compose-dock { height: 240px; border-top: 1px solid var(--border); background: #0b0c10; }
.dock-viz { width: 100%; height: 100%; }
.dock-toggle {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 5;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
}
.dock-toggle:hover { color: var(--primary); border-color: var(--primary); }

/* Perform */
.perform-view { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.perform-stage { position: relative; height: 46%; min-height: 240px; background: #07080b; border-bottom: 1px solid var(--border); }
.perform-viz { width: 100%; height: 100%; }
.perform-overlay { position: absolute; top: 12px; left: 12px; pointer-events: none; }
.now-playing-mini {
  display: flex; align-items: center; gap: 10px;
  background: rgba(14,15,20,0.7);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 14px;
  pointer-events: auto;
}
.np-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: var(--primary); }
.np-name { font-size: 15px; font-weight: 700; }
.np-beat { font-size: 12px; font-family: monospace; color: var(--muted-foreground); }
.np-reverse { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; background: rgba(245,158,11,0.18); color: #fbbf24; border: 1px solid rgba(245,158,11,0.45); animation: np-rev-blink 0.6s steps(2) infinite; }
@keyframes np-rev-blink { 50% { opacity: 0.55; } }
.np-play { width: 30px; height: 30px; border-radius: 6px; border: none; background: var(--muted); color: var(--foreground); cursor: pointer; }
.np-play.playing { background: #ef4444; color: #fff; }

.perform-content { flex: 1; overflow: hidden; display: flex; gap: 16px; padding: 16px; }
.perform-main { flex: 1; min-width: 0; overflow-y: auto; }
.perform-aside { width: 270px; flex-shrink: 0; overflow-y: auto; }
@media (max-width: 880px) { .perform-aside { display: none; } }

.perform-corner { position: absolute; top: 10px; right: 12px; font-size: 10px; letter-spacing: 0.08em; color: var(--muted-foreground); text-transform: uppercase; pointer-events: none; }

.perform-hints { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; padding: 8px 12px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
.ph-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted-foreground); }

.tag-filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.tf-chip { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--muted-foreground); cursor: pointer; transition: all 0.15s ease; }
.tf-chip:hover { color: var(--foreground); border-color: var(--primary); }
.tf-chip.active { background: color-mix(in oklab, var(--primary) 22%, transparent); color: var(--primary); border-color: var(--primary); }
.tf-nav-hint { display: inline-flex; align-items: center; gap: 2px; margin-right: 4px; opacity: 0.7; }
.tf-chip.vj { margin-left: auto; color: #a5b4fc; border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.12); }
.tf-chip.vj:hover { background: rgba(99,102,241,0.22); color: #c7d2fe; }
.set-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.set-card-tag { font-size: 9px; font-weight: 700; letter-spacing: 0.03em; padding: 1px 6px; border-radius: 4px; background: rgba(99,102,241,0.18); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.35); text-transform: uppercase; }
.hint-btn { margin-top: 6px; padding: 6px 14px; font-size: 13px; background: var(--card); border: 1px solid var(--primary); border-radius: 6px; color: var(--primary); cursor: pointer; }

.set-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.set-button { position: relative; padding: 16px; background: var(--card); border: 2px solid var(--border); border-radius: 12px; color: var(--foreground); cursor: pointer; transition: all 0.15s ease; text-align: left; overflow: hidden; }
.set-button:hover { border-color: var(--primary); transform: translateY(-2px); }
.set-button.selected { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.25); }
.set-button.active { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary) 25%, transparent); }
.set-button.playing { border-color: var(--primary); animation: glow 1.5s infinite; }
@keyframes glow { 0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.2); } 50% { box-shadow: 0 0 0 4px rgba(34,197,94,0.4); } }
.set-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.set-name { font-size: 16px; font-weight: 600; }
.set-tag { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; }
.set-tag.live { background: rgba(34,197,94,0.2); color: #22c55e; }
.set-tag.preview { background: rgba(56,189,248,0.18); color: #38bdf8; }
.set-actions { display: flex; gap: 6px; margin-top: 10px; }
.sa-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--muted); color: var(--foreground); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
.sa-btn:hover { border-color: var(--primary); }
.sa-btn.activate.on { background: rgba(34,197,94,0.2); color: #22c55e; border-color: #22c55e; }
.sa-btn.play:hover { background: rgba(34,197,94,0.15); }
.set-info { font-size: 12px; color: var(--muted-foreground); margin-bottom: 10px; }
.set-colors { display: flex; gap: 4px; flex-wrap: wrap; }
.color-dot { width: 15px; height: 15px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); }
.set-beat-indicator { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: var(--muted); }
.beat-fill { height: 100%; background: var(--primary); transition: width 0.1s linear; }
.empty-state { text-align: center; padding: 48px; color: var(--muted-foreground); }
.empty-state .hint { font-size: 14px; opacity: 0.7; margin-top: 6px; }

/* Stage 3D */
.stage-view { height: 100%; background: #07080b; }
.stage-viz { width: 100%; height: 100%; }
</style>
