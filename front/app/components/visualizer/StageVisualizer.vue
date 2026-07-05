<script setup lang="ts">
// 3D stage visualizer. Practice/testing tool: renders the live DMX frame
// in a virtual room with no hardware attached. See ./stageScene.ts for the
// three.js engine; this wrapper only wires store/serial reactivity + the
// edit overlay.
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { TRACK_COLORS } from '~/types/dmx'
import { createStageScene, type StageSceneController, type TransformMode } from '~/lib/stageScene'

const props = withDefaults(defineProps<{ mode?: 'view' | 'edit' }>(), { mode: 'view' })

// Merge the passthrough `class` (tailwind-merge dedupes h-/w- conflicts).
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const rootClass = computed(() =>
  cn('relative w-full h-full overflow-hidden bg-[#05060a]', attrs.class as any),
)

const store = useDMXStore()
const serial = useUnifiedSerial()
// Read the beat clock via useAppMode only (a pure singleton: no watchers, no WS).
// Calling useSetPlayer() here would register its effectful watchers an extra time.
const appMode = useAppMode()

const containerRef = ref<HTMLElement | null>(null)
let controller: StageSceneController | null = null

const transformMode = ref<TransformMode>('translate')

// Multi-selection (editor-local). store.selectedDeviceId stays the "primary"
// (drives the single-fixture detail panel + cross-component highlight); this
// list is the full set the gizmo/group/block-move operate on.
const selectedIds = ref<string[]>([])

// ── Edit overlay state ─────────────────────────────────────────
const selectedDevice = computed(() =>
  store.selectedDeviceId.value ? store.getDevice(store.selectedDeviceId.value) : null,
)
const selectedProfile = computed(() =>
  selectedDevice.value ? store.getProfile(selectedDevice.value.profileId) : null,
)
const channelRange = computed(() => {
  const d = selectedDevice.value
  const p = selectedProfile.value
  if (!d || !p) return null
  const start = d.startChannel
  const end = start + p.channelCount - 1
  return { start, end, count: p.channelCount }
})
// Other devices whose DMX range overlaps the selected device's range.
const collisions = computed(() => {
  const d = selectedDevice.value
  const r = channelRange.value
  if (!d || !r) return [] as string[]
  const out: string[] = []
  for (const other of store.devices.value) {
    if (other.id === d.id) continue
    const op = store.getProfile(other.profileId)
    if (!op) continue
    const oStart = other.startChannel
    const oEnd = oStart + op.channelCount - 1
    if (r.start <= oEnd && oStart <= r.end) out.push(other.name)
  }
  return out
})
const outOfFrame = computed(() => (channelRange.value ? channelRange.value.end > 100 : false))

// Stage dimension inputs (write straight to the store; the deep watch below
// pushes the change into the scene).
function clampDim(v: number) { return Math.max(2, Math.min(30, Number.isFinite(v) ? v : 6)) }
const stageWidth = computed({ get: () => store.stage.value.width, set: v => store.setStage({ width: clampDim(v) }) })
const stageDepth = computed({ get: () => store.stage.value.depth, set: v => store.setStage({ depth: clampDim(v) }) })
const stageHeight = computed({ get: () => store.stage.value.height, set: v => store.setStage({ height: clampDim(v) }) })

function setTransformMode(m: TransformMode) {
  transformMode.value = m
  controller?.setTransformMode(m)
}
function deselect() {
  store.selectDevice(null)
}

// ── Rig: quick add + formations ────────────────────────────────
const GRID = 0.5 // metres - positions snap to this grid by default
const snap = (v: number) => Math.round(v / GRID) * GRID
const snapVec = (p: { x: number; y: number; z: number }) => ({ x: snap(p.x), y: snap(p.y), z: snap(p.z) })

function spread(k: number, halfW: number): number[] {
  if (k <= 1) return [0]
  return Array.from({ length: k }, (_, i) => snap(-halfW + (2 * halfW * i) / (k - 1)))
}

// Aim a fixture at a target point. Beam points along the group's local -Y,
// so we build the rotation from (0,-1,0) -> direction (matches the renderer).
function aimRotation(pos: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) {
  const dir = new THREE.Vector3(target.x - pos.x, target.y - pos.y, target.z - pos.z)
  if (dir.lengthSq() < 1e-6) return { x: 0, y: 0, z: 0 }
  dir.normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')
  const R = 180 / Math.PI
  return { x: Math.round(e.x * R), y: Math.round(e.y * R), z: Math.round(e.z * R) }
}

function applyFormation(kind: 'v-cross' | 'line' | 'pairs') {
  const devs = store.devices.value
  const n = devs.length
  if (n === 0) return
  // Ensure enough ceiling height for a proper "hanging rig" look (short rooms
  // make beams splay onto the floor immediately). Non-destructive: only raises.
  const s = { ...store.stage.value }
  if (s.height < 5) { s.height = 5; store.setStage({ height: 5 }) }
  // Hang fixtures high (just under the ceiling) so beams read as long tubes.
  const y = snap(Math.max(2.4, s.height - 0.4))
  const halfW = s.width * 0.36

  if (kind === 'line') {
    const xs = spread(n, halfW)
    devs.forEach((d, i) => {
      const pos = { x: xs[i] ?? 0, y, z: -s.depth * 0.18 }
      const target = { x: pos.x, y: 0.1, z: s.depth * 0.32 } // down + toward audience
      const sp = snapVec(pos)
      store.updateDeviceTransform(d.id, { position: sp, rotation: aimRotation(sp, target) })
    })
    return
  }

  if (kind === 'pairs') {
    // Two cadenas of CONSECUTIVE lights: left bar = first half (1,2,3),
    // right bar = second half (4,5,6). Each light crosses its frontal partner
    // at the same depth (1<->4, 2<->5, 3<->6). Same-bar lights never collide.
    const half = Math.ceil(n / 2)
    const zs = spread(half, s.depth * 0.32)
    const sideX = s.width * 0.4
    devs.forEach((d, i) => {
      const left = i < half
      const row = left ? i : i - half
      const px = left ? -sideX : sideX
      const pz = zs[row] ?? 0
      const pos = { x: px, y, z: pz }
      // both lights of the pair aim at the SAME floor vertex at their own depth
      // -> a clean symmetric V (beams meet there, no overshoot). Each pair gets
      // its own vertex (different depth), so it's not one big convergence.
      const target = { x: 0, y: 0.05, z: pz }
      const sp = snapVec(pos)
      store.updateDeviceTransform(d.id, { position: sp, rotation: aimRotation(sp, target) })
    })
    return
  }

  // V-Cross: two rows ("cadenas"). Back row sweeps forward, front row sweeps
  // back, each only slightly inward - so beams cross in a BAND across the middle
  // (not all converging to one blinding point).
  const backCount = Math.ceil(n / 2)
  const rows = [devs.slice(0, backCount), devs.slice(backCount)]
  const rowZ = [-s.depth * 0.30, s.depth * 0.18]
  rows.forEach((row, r) => {
    const xs = spread(row.length, halfW)
    row.forEach((d, i) => {
      const px = xs[i] ?? 0
      const pz = rowZ[r] ?? 0
      const pos = { x: px, y, z: pz }
      // aim forward if back row, backward if front row; only mild x cross
      const target = { x: -px * 0.35, y: 0.12, z: -Math.sign(pz || -1) * s.depth * 0.22 }
      const sp = snapVec(pos)
      store.updateDeviceTransform(d.id, { position: sp, rotation: aimRotation(sp, target) })
    })
  })
}

function quickAddPinspot() {
  const used = store.devices.value
  const ends = used.map(d => d.startChannel + (store.getProfile(d.profileId)?.channelCount ?? 5))
  const next = ends.length ? Math.max(...ends) : 1
  store.addDevice({ name: `PinSpot ${used.length + 1}`, profileId: 'pinspot-rgbw-5ch', startChannel: next, tags: ['pinspot'] })
}

// Trim/grow to exactly N fixtures (keeps the first N + their tracks), then arrange.
const rigCount = ref(6)
function resetRig() {
  const target = Math.max(1, Math.min(24, Math.round(rigCount.value || 6)))
  const cur = store.devices.value.length
  if (cur > target) {
    const ok = window.confirm(
      `Reset rig to ${target} light${target === 1 ? '' : 's'}?\nThis deletes ${cur - target} fixture(s) and re-arranges the rest in a V-Cross.`,
    )
    if (!ok) return
  }
  while (store.devices.value.length > target) {
    const last = store.devices.value[store.devices.value.length - 1]
    if (!last) break
    store.deleteDevice(last.id)
  }
  while (store.devices.value.length < target) quickAddPinspot()
  applyFormation('v-cross')
}

// Create control groups matching the Pairs rig: the two cadenas/sides
// (Left = 1,2,3 / Right = 4,5,6) and the frontal crossing rows (Row 1 = 1&4,
// Row 2 = 2&5, Row 3 = 3&6).
function makeAutoGroups() {
  const devs = store.devices.value
  if (devs.length < 2) return
  const profileId = devs[0]?.profileId ?? 'pinspot-rgbw-5ch'
  const half = Math.ceil(devs.length / 2)
  const col = (i: number) => TRACK_COLORS[i % TRACK_COLORS.length]!

  // clear previous auto-groups (incl. older naming) so re-running self-heals + no dupes
  const autoNames = new Set<string>(['Left', 'Right'])
  for (let k = 0; k < half; k++) {
    autoNames.add(`Row ${k + 1}`)
    autoNames.add(`Pair ${k + 1}&${half + k + 1}`)
  }
  for (const g of [...store.groups.value]) if (autoNames.has(g.name)) store.deleteGroup(g.id)

  let c = 0
  // sides = the two bars
  store.addGroup({ name: 'Left', profileId, deviceIds: devs.slice(0, half).map(d => d.id), color: col(c++) })
  store.addGroup({ name: 'Right', profileId, deviceIds: devs.slice(half).map(d => d.id), color: col(c++) })
  // rows = frontal crossing pair left[k] + right[k]  (Row 1 = 1&4, Row 2 = 2&5, ...)
  for (let k = 0; k < half; k++) {
    const ids = [devs[k]?.id, devs[half + k]?.id].filter(Boolean) as string[]
    if (ids.length) store.addGroup({ name: `Row ${k + 1}`, profileId, deviceIds: ids, color: col(c++) })
  }
}

function deleteDevice(id: string) {
  store.deleteDevice(id)
}
function deleteSelected() {
  if (store.selectedDeviceId.value) {
    store.deleteDevice(store.selectedDeviceId.value)
    store.selectDevice(null)
  }
}

// Camera view presets (3d perspective vs overhead plan)
const cameraView = ref<'3d' | 'top'>('3d')
function setView(v: '3d' | 'top') {
  cameraView.value = v
  controller?.setCameraView(v)
}

// ── Multi-select + grouping ────────────────────────────────────
function deviceName(id: string) { return store.getDevice(id)?.name ?? id }

// Toggle a fixture in/out of the multi-selection (checkbox / shift-click).
function toggleInSelection(id: string) {
  if (selectedIds.value.includes(id)) {
    const next = selectedIds.value.filter(x => x !== id)
    selectedIds.value = next
    store.selectDevice(next[next.length - 1] ?? null)
  } else {
    selectedIds.value = [...selectedIds.value, id]
    store.selectDevice(id)
  }
}

// Click a fixture row. Plain click = select just this one (toggle off if it was
// the only one). Shift/Cmd/Ctrl click = add/remove from the selection.
function selectFromList(id: string, e?: MouseEvent) {
  if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) { toggleInSelection(id); return }
  if (selectedIds.value.length === 1 && selectedIds.value[0] === id) {
    selectedIds.value = []
    store.selectDevice(null)
  } else {
    selectedIds.value = [id]
    store.selectDevice(id)
  }
}

function clearSelection() {
  selectedIds.value = []
  store.selectDevice(null)
}

// Move every selected fixture by a fixed step (block move, keeps relative layout).
function nudgeSelected(axis: 'x' | 'y' | 'z', delta: number) {
  for (const id of selectedIds.value) {
    const d = store.getDevice(id)
    if (!d) continue
    const cur = d.position ?? { x: 0, y: 2.4, z: 0 }
    store.updateDeviceTransform(id, { position: { ...cur, [axis]: (cur[axis] ?? 0) + delta } })
  }
}

// Make a control group out of the current selection.
const groupName = ref('')
const groupCreatedMsg = ref('')
function createGroupFromSelection() {
  const name = groupName.value.trim()
  if (!name || selectedIds.value.length < 1) return
  const first = store.getDevice(selectedIds.value[0]!)
  const profileId = first?.profileId ?? 'pinspot-rgbw-5ch'
  const color = TRACK_COLORS[store.groups.value.length % TRACK_COLORS.length]!
  store.addGroup({ name, profileId, deviceIds: [...selectedIds.value], color })
  groupCreatedMsg.value = `Created "${name}" (${selectedIds.value.length} lights)`
  groupName.value = ''
}

// Raise/lower EVERY fixture together (easy "move the whole rig up/down").
function raiseAllFixtures(delta: number) {
  for (const d of store.devices.value) {
    const cur = d.position ?? { x: 0, y: 2.4, z: 0 }
    store.updateDeviceTransform(d.id, { position: { ...cur, y: Math.max(0.3, (cur.y ?? 0) + delta) } })
  }
}

// Nudge just the selected fixture up/down (gizmo's vertical axis is fiddly).
function nudgeSelY(delta: number) {
  const d = selectedDevice.value
  if (!d) return
  const cur = d.position ?? { x: 0, y: 2.4, z: 0 }
  store.updateDeviceTransform(d.id, { position: { ...cur, y: Math.max(0.3, (cur.y ?? 0) + delta) } })
}

// Edit the selected fixture's position numerically (for exact symmetric placement).
function setSelPos(axis: 'x' | 'y' | 'z', v: string) {
  const d = selectedDevice.value
  if (!d) return
  const n = Number(v)
  if (!Number.isFinite(n)) return
  const cur = d.position ?? { x: 0, y: 2.4, z: 0 }
  store.updateDeviceTransform(d.id, { position: { ...cur, [axis]: n } })
}

onMounted(() => {
  if (typeof window === 'undefined' || !containerRef.value) return
  controller = createStageScene({
    mode: props.mode,
    getFrame: () => serial.currentFrame.value as unknown as number[],
    resolveProfile: id => store.getProfile(id),
    onSelect: id => store.selectDevice(id),
    onTransform: (id, t) => store.updateDeviceTransform(id, t),
    getBeat: () => ({ phase: appMode.getInternalPhase(), isPlaying: appMode.internalPlaying.value }),
  })
  controller.mount(containerRef.value)
  controller.setStage({ ...store.stage.value })
  controller.setDevices(store.devices.value)
  selectedIds.value = store.selectedDeviceId.value ? [store.selectedDeviceId.value] : []
  controller.setSelection([...selectedIds.value])
  controller.setTransformMode(transformMode.value)

  watch(store.stage, s => controller?.setStage({ width: s.width, depth: s.depth, height: s.height }), { deep: true })
  watch(store.devices, () => {
    controller?.setDevices(store.devices.value)
    // Drop any selected ids whose fixture was removed.
    const existing = new Set(store.devices.value.map(d => d.id))
    const filtered = selectedIds.value.filter(id => existing.has(id))
    if (filtered.length !== selectedIds.value.length) selectedIds.value = filtered
  }, { deep: true })
  watch(selectedIds, ids => controller?.setSelection([...ids]))
  // External selects (3D click, other components) sync into the multi-list.
  watch(() => store.selectedDeviceId.value, id => {
    if (id && !selectedIds.value.includes(id)) selectedIds.value = [id]
    else if (!id) selectedIds.value = []
  })
  watch(() => props.mode, m => controller?.setMode(m))
})

onBeforeUnmount(() => {
  controller?.dispose()
  controller = null
})
</script>

<template>
  <div :class="rootClass">
    <!-- three.js canvas host -->
    <div ref="containerRef" class="absolute inset-0" />

    <!-- Edit overlay (no pointer events except on the panel itself) -->
    <div v-if="props.mode === 'edit'" class="pointer-events-none absolute inset-0 p-3">
      <div
        class="pointer-events-auto flex max-h-[calc(100%-1.5rem)] w-64 flex-col overflow-y-auto rounded-lg border border-white/10 bg-[#0e0f14]/92 p-3 text-xs text-neutral-300 shadow-xl backdrop-blur"
      >
        <!-- Stage header: camera view -->
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Stage</span>
          <div class="flex gap-1">
            <button class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors" :class="cameraView === '3d' ? 'bg-white/15 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'" @click="setView('3d')">3D</button>
            <button class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors" :class="cameraView === 'top' ? 'bg-white/15 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'" @click="setView('top')">Top</button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-[10px] text-neutral-500">Width</span>
            <input v-model.number="stageWidth" type="number" min="2" max="30" step="0.5"
              class="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200 outline-none focus:border-sky-500/60" >
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[10px] text-neutral-500">Depth</span>
            <input v-model.number="stageDepth" type="number" min="2" max="30" step="0.5"
              class="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200 outline-none focus:border-sky-500/60" >
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[10px] text-neutral-500">Height</span>
            <input v-model.number="stageHeight" type="number" min="2" max="15" step="0.5"
              class="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-neutral-200 outline-none focus:border-sky-500/60" >
          </label>
        </div>

        <div class="my-3 h-px bg-white/10" />

        <!-- Rig: reset to N + quick add + formations -->
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Rig</span>
          <button class="rounded bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-white/10" @click="quickAddPinspot">+ PinSpot</button>
        </div>
        <div class="mb-1 flex items-center gap-1">
          <input v-model.number="rigCount" type="number" min="1" max="24" title="How many lights you want"
            class="w-11 rounded border border-white/10 bg-black/40 px-1.5 py-1 text-center text-neutral-200 outline-none focus:border-sky-500/60" >
          <button class="flex-1 rounded bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-300 hover:bg-rose-500/25"
            title="Set the rig to exactly this many PinSpots, then auto-arrange them. Asks before deleting." @click="resetRig">Rebuild to {{ rigCount }} lights</button>
        </div>
        <p class="mb-1.5 text-[10px] text-neutral-500">Sets the fixture count to N and auto-arranges (deletes extras after a confirm).</p>
        <div class="mb-1 flex gap-1">
          <button class="flex-1 rounded bg-sky-500/20 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/35" @click="applyFormation('pairs')" title="Reset to the inverted-V: left bar 1-2-3, right bar 4-5-6; 1&4 2&5 3&6 cross">Pairs (V)</button>
          <button class="flex-1 rounded bg-white/5 px-2 py-1 text-[10px] font-medium text-neutral-300 hover:bg-sky-500/30" @click="applyFormation('v-cross')">V-Cross</button>
          <button class="flex-1 rounded bg-white/5 px-2 py-1 text-[10px] font-medium text-neutral-300 hover:bg-sky-500/30" @click="applyFormation('line')">Line</button>
        </div>
        <div class="mb-1 flex items-center gap-1">
          <span class="mr-auto text-[10px] text-neutral-500">Rig height (all)</span>
          <button class="rounded bg-white/5 px-2 py-1 text-[10px] text-neutral-300 hover:bg-sky-500/30" title="Lower every fixture 0.25m" @click="raiseAllFixtures(-0.25)">▼ Lower</button>
          <button class="rounded bg-white/5 px-2 py-1 text-[10px] text-neutral-300 hover:bg-sky-500/30" title="Raise every fixture 0.25m" @click="raiseAllFixtures(0.25)">▲ Raise</button>
        </div>
        <button class="mb-1 w-full rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25" @click="makeAutoGroups" title="Create Left/Right (sides) + Row 1/2/3 (frontal crosses)">Make groups (sides + rows)</button>
        <p class="mb-3 text-[10px] text-neutral-500">Pairs = bars 1·2·3 / 4·5·6, frontal cross. Groups: Left, Right + Row 1 (1&amp;4) / Row 2 (2&amp;5) / Row 3 (3&amp;6).</p>

        <div class="mb-2 h-px bg-white/10" />

        <!-- Fixtures list: tick boxes to multi-select, click name to select one -->
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Fixtures ({{ store.devices.value.length }})</span>
          <span class="text-[9px] text-neutral-500">tick to multi-select</span>
        </div>
        <div class="mb-2 max-h-44 space-y-0.5 overflow-y-auto pr-0.5">
          <div v-for="d in store.devices.value" :key="d.id"
            class="group flex items-center gap-2 rounded px-2 py-1"
            :class="selectedIds.includes(d.id)
              ? (store.selectedDeviceId.value === d.id ? 'bg-sky-500/30 text-white' : 'bg-sky-500/15 text-white')
              : 'hover:bg-white/5'">
            <input type="checkbox" class="h-3 w-3 shrink-0 cursor-pointer accent-sky-500"
              :checked="selectedIds.includes(d.id)" @click.stop="toggleInSelection(d.id)" >
            <span class="flex-1 cursor-pointer truncate" @click="selectFromList(d.id, $event)">{{ d.name }}</span>
            <span class="flex shrink-0 items-center gap-1.5">
              <span class="text-[10px] text-neutral-500">CH{{ d.startChannel }}</span>
              <button class="px-0.5 text-red-400/70 hover:text-red-400" title="Delete fixture" @click.stop="deleteDevice(d.id)">×</button>
            </span>
          </div>
          <div v-if="store.devices.value.length === 0" class="px-2 py-1 text-[10px] text-neutral-500">No fixtures. Use Reset or + PinSpot.</div>
        </div>

        <!-- Multi-selection: block move + create group -->
        <template v-if="selectedIds.length >= 2">
          <div class="my-1 h-px bg-white/10" />
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[11px] font-semibold text-sky-300">Selection ({{ selectedIds.length }})</span>
            <button class="rounded bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-white/10" @click="clearSelection">Clear</button>
          </div>
          <div class="mb-2 flex flex-wrap gap-1">
            <span v-for="id in selectedIds" :key="id" class="flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-neutral-200">
              {{ deviceName(id) }}
              <button class="text-neutral-500 hover:text-red-400" title="Remove from selection" @click="toggleInSelection(id)">×</button>
            </span>
          </div>

          <div class="mb-1 text-[10px] text-neutral-500">Move all (drag the gizmo, or nudge {{ GRID }}m):</div>
          <div class="mb-2 grid grid-cols-3 gap-1">
            <div v-for="ax in (['x','y','z'] as const)" :key="ax" class="flex flex-col items-center gap-0.5">
              <span class="text-[9px] uppercase text-neutral-500">{{ ax === 'x' ? 'X L/R' : ax === 'y' ? 'Y up' : 'Z depth' }}</span>
              <div class="flex gap-0.5">
                <button class="w-6 rounded bg-white/5 py-0.5 text-[11px] text-neutral-300 hover:bg-sky-500/30" @click="nudgeSelected(ax, -GRID)">−</button>
                <button class="w-6 rounded bg-white/5 py-0.5 text-[11px] text-neutral-300 hover:bg-sky-500/30" @click="nudgeSelected(ax, GRID)">+</button>
              </div>
            </div>
          </div>

          <div class="mb-1 text-[10px] text-neutral-500">Group name</div>
          <div class="flex gap-1">
            <input v-model="groupName" placeholder="e.g. Front row" @keyup.enter="createGroupFromSelection"
              class="flex-1 rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-neutral-200 outline-none focus:border-emerald-500/60" >
            <button class="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
              :disabled="!groupName.trim()" @click="createGroupFromSelection">Create group</button>
          </div>
          <p v-if="groupCreatedMsg" class="mt-1 text-[10px] text-emerald-400">{{ groupCreatedMsg }}</p>
        </template>

        <!-- Selected fixture detail + move/rotate + delete (single selection) -->
        <template v-else-if="selectedDevice">
          <div class="my-1 h-px bg-white/10" />
          <div class="mb-1 flex items-center justify-between">
            <span class="truncate text-[11px] font-semibold text-neutral-100">{{ selectedDevice.name }}</span>
            <div class="flex gap-1">
              <button class="rounded bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/25" @click="deleteSelected">Delete</button>
              <button class="rounded bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-white/10" @click="deselect">Deselect</button>
            </div>
          </div>
          <div class="text-neutral-500">{{ selectedProfile?.name ?? selectedDevice.profileId }}</div>
          <div class="text-neutral-400">
            DMX <span class="text-neutral-200">{{ channelRange?.start }}</span>
            <span v-if="channelRange"> – {{ channelRange.end }}</span>
            <span class="text-neutral-500"> ({{ channelRange?.count }} ch)</span>
          </div>
          <div class="mt-1.5 flex gap-1">
            <button class="flex-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors" :class="transformMode === 'translate' ? 'bg-sky-500/80 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'" @click="setTransformMode('translate')">Move</button>
            <button class="flex-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors" :class="transformMode === 'rotate' ? 'bg-sky-500/80 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'" @click="setTransformMode('rotate')">Rotate</button>
          </div>
          <div class="mt-1.5 grid grid-cols-3 gap-1">
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-500">X (L/R)</span>
              <input type="number" step="0.5" :value="(selectedDevice.position?.x ?? 0).toFixed(1)"
                @change="setSelPos('x', ($event.target as HTMLInputElement).value)"
                class="w-full rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-neutral-200 outline-none focus:border-sky-500/60" >
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-500">Y (up)</span>
              <input type="number" step="0.5" :value="(selectedDevice.position?.y ?? 0).toFixed(1)"
                @change="setSelPos('y', ($event.target as HTMLInputElement).value)"
                class="w-full rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-neutral-200 outline-none focus:border-sky-500/60" >
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-neutral-500">Z (depth)</span>
              <input type="number" step="0.5" :value="(selectedDevice.position?.z ?? 0).toFixed(1)"
                @change="setSelPos('z', ($event.target as HTMLInputElement).value)"
                class="w-full rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-neutral-200 outline-none focus:border-sky-500/60" >
            </label>
          </div>
          <div class="mt-1.5 flex items-center gap-1">
            <span class="mr-auto text-[9px] text-neutral-500">Height (easy up/down)</span>
            <button class="rounded bg-white/5 px-2.5 py-0.5 text-[11px] text-neutral-300 hover:bg-sky-500/30" title="Lower 0.25m" @click="nudgeSelY(-0.25)">▼</button>
            <button class="rounded bg-white/5 px-2.5 py-0.5 text-[11px] text-neutral-300 hover:bg-sky-500/30" title="Raise 0.25m" @click="nudgeSelY(0.25)">▲</button>
          </div>
          <div v-if="collisions.length" class="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
            Address overlaps: {{ collisions.join(', ') }}
          </div>
          <div v-if="outOfFrame" class="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
            Channel range exceeds 100 (out of frame)
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
