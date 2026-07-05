// ═══════════════════════════════════════════════════════════════
// stageScene.ts - Framework-agnostic three.js engine for the DMX
// stage visualizer. Holds NO Vue reactivity: the Vue wrapper feeds it
// plain snapshots (stage dims, devices, live DMX frame) and receives
// callbacks (selection, transform edits).
//
// Coordinate convention (room space == three world space, 1:1):
//   x = left/right (0 = center)
//   y = up (0 = floor)
//   z = depth (negative = back wall, positive = audience / camera side)
//   rotation = Euler DEGREES (order XYZ), beam aims along the fixture's
//   local -Y after that rotation is applied.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { decodeFixture } from '~/types/dmx'
import type { Device, DeviceProfile, Stage, Vec3 } from '~/types/dmx'

const DEG = Math.PI / 180
const DEFAULT_BEAM_ANGLE = 7 // degrees, cone half-angle fallback (tight tube)
const POS_SNAP = 0.5       // metres - magnetic position grid
const ROT_SNAP_DEG = 15    // degrees - magnetic rotation increments
// Aim used when a device has no stored rotation: down + toward audience (+z).
const DEFAULT_AIM_DEG: Vec3 = { x: -25, y: 0, z: 0 }

export interface StageSceneOptions {
  mode: 'view' | 'edit'
  /** Returns the live 100-channel DMX frame (0-255). Read every frame. */
  getFrame: () => number[]
  /** Resolve a profile id to its definition (or null). */
  resolveProfile: (profileId: string) => DeviceProfile | null
  /** Raycast click selected a fixture (or empty space -> null). */
  onSelect?: (id: string | null) => void
  /** Gizmo edited a fixture transform; write back to the store. */
  onTransform?: (id: string, t: { position?: Vec3; rotation?: Vec3 }) => void
  /** Live beat info for the floor pulse (optional; no-op when absent). */
  getBeat?: () => { phase: number; isPlaying: boolean }
}

export type TransformMode = 'translate' | 'rotate'

interface FixtureViz {
  device: Device
  profile: DeviceProfile | null
  usedFallbackPos: boolean
  usedFallbackRot: boolean
  fallbackIndex: number
  group: THREE.Group        // positioned + oriented; beam dir = local -Y
  body: THREE.Mesh          // pickable; userData.deviceId set
  lens: THREE.Mesh          // glowing disc (color * intensity)
  lensMat: THREE.MeshBasicMaterial
  glow: THREE.Sprite        // soft halo at the lens
  glowMat: THREE.SpriteMaterial
  beam: THREE.Mesh          // additive cone
  beamMat: THREE.MeshBasicMaterial
  pool: THREE.Mesh          // additive landing spot (world space, child of scene)
  poolMat: THREE.MeshBasicMaterial
  bodyMat: THREE.MeshStandardMaterial
  beamAngle: number
}

// Reused scratch objects (avoid per-frame allocations).
const _color = new THREE.Color()
const _dir = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _point = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _qAim = new THREE.Quaternion()
const _qDisc = new THREE.Quaternion()
const _vUp = new THREE.Vector3(0, -1, 0)
const _vZ = new THREE.Vector3(0, 0, 1)

// ── Soft radial sprite texture (shared) ─────────────────────────
function makeRadialTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ── Beam landing: nearest room surface hit from origin along dir ──
function computeLanding(origin: THREE.Vector3, dir: THREE.Vector3, stage: Stage, out: { point: THREE.Vector3; normal: THREE.Vector3 }): number {
  const hw = stage.width / 2
  const hd = stage.depth / 2
  const h = stage.height
  const eps = 1e-4
  let best = Infinity

  // Each plane: a point on it (px,py,pz), its normal (nx,ny,nz), and a
  // bounds-check on the hit point so we only count the finite face.
  const planes: Array<[number, number, number, number, number, number, (p: THREE.Vector3) => boolean]> = [
    [0, 0, 0, 0, 1, 0, p => p.x >= -hw - eps && p.x <= hw + eps && p.z >= -hd - eps && p.z <= hd + eps],   // floor
    [0, h, 0, 0, -1, 0, p => p.x >= -hw - eps && p.x <= hw + eps && p.z >= -hd - eps && p.z <= hd + eps],  // ceiling
    [0, 0, -hd, 0, 0, 1, p => p.x >= -hw - eps && p.x <= hw + eps && p.y >= -eps && p.y <= h + eps],       // back wall
    [0, 0, hd, 0, 0, -1, p => p.x >= -hw - eps && p.x <= hw + eps && p.y >= -eps && p.y <= h + eps],       // front wall
    [-hw, 0, 0, 1, 0, 0, p => p.z >= -hd - eps && p.z <= hd + eps && p.y >= -eps && p.y <= h + eps],       // left wall
    [hw, 0, 0, -1, 0, 0, p => p.z >= -hd - eps && p.z <= hd + eps && p.y >= -eps && p.y <= h + eps],       // right wall
  ]

  for (const [px, py, pz, nx, ny, nz, inBounds] of planes) {
    const denom = dir.x * nx + dir.y * ny + dir.z * nz
    if (Math.abs(denom) < eps) continue
    const t = ((px - origin.x) * nx + (py - origin.y) * ny + (pz - origin.z) * nz) / denom
    if (t <= eps || t >= best) continue
    _point.set(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t)
    if (!inBounds(_point)) continue
    best = t
    out.point.copy(_point)
    out.normal.set(nx, ny, nz)
  }

  if (!isFinite(best)) {
    // Fallback: shoot a fixed length (shouldn't happen for in-room fixtures).
    const diag = Math.sqrt(stage.width ** 2 + stage.depth ** 2 + stage.height ** 2)
    best = diag
    out.point.set(origin.x + dir.x * best, origin.y + dir.y * best, origin.z + dir.z * best)
    out.normal.copy(dir).multiplyScalar(-1)
  }
  return best
}

export function createStageScene(opts: StageSceneOptions) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060a)
  scene.fog = new THREE.FogExp2(0x05060a, 0.035)

  let stage: Stage = { width: 6, depth: 4, height: 3 }
  let mode: 'view' | 'edit' = opts.mode
  let transformMode: TransformMode = 'translate'

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true
  orbit.dampingFactor = 0.08
  orbit.maxPolarAngle = Math.PI * 0.92

  // Ambiance (cheap, no shadows). Real fixture light is faked additively.
  scene.background = new THREE.Color(0x0b0d12)
  scene.add(new THREE.AmbientLight(0x4a5a72, 1.5))
  const key = new THREE.PointLight(0x99bbff, 10, 0, 1.4)
  scene.add(key)

  const radialTex = makeRadialTexture()

  // Beat-pulse ring on the floor: a single additive ring that expands + fades
  // each beat (animated in tick from opts.getBeat). depthWrite:false so it never
  // z-fights the floor/grid. Created once; disposed in dispose().
  const ringGeo = new THREE.RingGeometry(0.2, 0.26, 48)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  })
  const beatRing = new THREE.Mesh(ringGeo, ringMat)
  beatRing.rotation.x = -Math.PI / 2
  beatRing.position.y = 0.012
  scene.add(beatRing)

  // ── Room ──────────────────────────────────────────────────────
  let roomGroup = new THREE.Group()
  scene.add(roomGroup)
  const roomGeoms: THREE.BufferGeometry[] = []
  const roomMats: THREE.Material[] = []

  function buildRoom() {
    scene.remove(roomGroup)
    for (const g of roomGeoms) g.dispose()
    for (const m of roomMats) m.dispose()
    roomGeoms.length = 0
    roomMats.length = 0
    roomGroup = new THREE.Group()

    const { width: w, depth: d, height: h } = stage

    // Floor + grid only - no walls (they blocked the view). Lighter so the
    // room reads clearly and fixtures/beams stay visible.
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x171c28, roughness: 0.9, metalness: 0.1 })
    const floorGeo = new THREE.PlaneGeometry(w, d)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    roomGroup.add(floor)
    roomGeoms.push(floorGeo); roomMats.push(floorMat)

    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(2, Math.round(Math.max(w, d))), 0x4a5874, 0x2a3346)
    grid.position.y = 0.002
    // Clip grid to floor footprint by scaling (GridHelper is square).
    grid.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d))
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.65
    roomGroup.add(grid)
    roomGeoms.push(grid.geometry)
    roomMats.push(grid.material as THREE.Material)

    scene.add(roomGroup)
    key.position.set(0, h * 0.95, d * 0.3)
  }

  // Frame by the floor FOOTPRINT (width/depth), not ceiling height - fixtures
  // hang low (~2.6m) so a tall room must not push the camera away.
  function frameCamera() {
    const { width: w, depth: d } = stage
    const span = Math.max(w, d)
    camera.position.set(w * 0.12, span * 0.75 + 2.5, d + span * 0.5 + 2)
    orbit.target.set(0, 1.2, 0)
    orbit.update()
  }

  // Camera presets. 'top' = overhead plan view (like a top-down rig diagram).
  function setCameraView(view: '3d' | 'top') {
    const { width: w, depth: d } = stage
    if (view === 'top') {
      camera.position.set(0, Math.max(w, d) * 1.3 + 2, 0.001)
      orbit.target.set(0, 0, 0)
      orbit.update()
    } else {
      frameCamera()
    }
  }

  // ── Fixtures ──────────────────────────────────────────────────
  const fixtures = new Map<string, FixtureViz>()
  const pickList: THREE.Object3D[] = [] // bodies for raycasting

  function autoPlace(index: number): Vec3 {
    const s = stage
    const perRow = Math.max(1, Math.min(8, Math.round(s.width)))
    const col = index % perRow
    const row = Math.floor(index / perRow)
    return {
      x: -s.width / 2 + (s.width / (perRow + 1)) * (col + 1),
      y: Math.min(s.height - 0.3, 2.4),
      z: -s.depth / 2 + 0.6 + row * 0.9,
    }
  }

  // Returns the body mesh + `frontOffset`: distance from the group origin down
  // to the emitting face (where the lens/beam start), so the lens sits flush
  // regardless of body size/type. Bodies are sized ~2x the old ones - the old
  // meshes read as "ultra tiny" next to the beams/pools.
  function buildBodyMesh(profile: DeviceProfile | null): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; frontOffset: number } {
    const type = profile?.fixtureType ?? 'pinspot'
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a4154, roughness: 0.5, metalness: 0.6 })
    let geo: THREE.BufferGeometry
    let frontOffset: number
    switch (type) {
      case 'par':
        geo = new THREE.CylinderGeometry(0.19, 0.16, 0.26, 20)
        frontOffset = 0.15
        break
      case 'strobe':
        geo = new THREE.BoxGeometry(0.5, 0.16, 0.26)
        frontOffset = 0.11
        break
      case 'moving-head':
        geo = new THREE.BoxGeometry(0.26, 0.3, 0.26)
        frontOffset = 0.17
        break
      case 'laser':
        geo = new THREE.BoxGeometry(0.24, 0.18, 0.24)
        frontOffset = 0.11
        break
      case 'pinspot':
      default:
        geo = new THREE.CylinderGeometry(0.1, 0.13, 0.3, 18)
        frontOffset = 0.17
        break
    }
    const mesh = new THREE.Mesh(geo, mat)
    return { mesh, mat, frontOffset }
  }

  function applyTransformToGroup(fx: FixtureViz) {
    const d = fx.device
    const pos = d.position ?? autoPlace(fx.fallbackIndex)
    fx.group.position.set(pos.x, pos.y, pos.z)
    const rot = d.rotation ?? DEFAULT_AIM_DEG
    fx.group.rotation.set(rot.x * DEG, rot.y * DEG, rot.z * DEG, 'XYZ')
    fx.group.updateMatrixWorld(true)
  }

  // Rebuild beam cone geometry + pool placement from current group transform.
  function refreshBeam(fx: FixtureViz) {
    fx.group.updateMatrixWorld(true)
    _origin.setFromMatrixPosition(fx.group.matrixWorld)
    _dir.copy(_vUp).applyQuaternion(fx.group.getWorldQuaternion(_qAim)).normalize()

    const landing = { point: _point.clone(), normal: _normal.clone() }
    const dist = Math.max(0.2, computeLanding(_origin, _dir, stage, landing))
    const half = (fx.beamAngle || DEFAULT_BEAM_ANGLE) * DEG
    const radius = Math.max(0.02, Math.tan(half) * dist)

    fx.beam.geometry.dispose()
    // Cone along Y; translate so apex sits at the group origin and it
    // widens downward toward -Y (the aim direction in local space).
    const cone = new THREE.ConeGeometry(radius, dist, 28, 1, true)
    cone.translate(0, -dist / 2, 0)
    // Vertex-color falloff: bright at apex (y≈0), fading toward the base.
    const pos = cone.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const f = 1 - Math.min(1, -y / dist) // 1 at apex, 0 at base
      const v = 0.25 + 0.75 * f
      colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v
    }
    cone.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fx.beam.geometry = cone

    // Pool on the landing surface (world space).
    fx.pool.position.copy(landing.point).addScaledVector(landing.normal, 0.012)
    _qDisc.setFromUnitVectors(_vZ, landing.normal)
    fx.pool.quaternion.copy(_qDisc)
    const poolSize = Math.max(0.25, radius * 2.2)
    fx.pool.scale.set(poolSize, poolSize, poolSize)
  }

  function createFixture(device: Device, fallbackIndex: number): FixtureViz {
    const profile = opts.resolveProfile(device.profileId)
    const group = new THREE.Group()

    const { mesh: body, mat: bodyMat, frontOffset } = buildBodyMesh(profile)
    body.userData.deviceId = device.id
    group.add(body)

    // Lens disc at the front (local -Y face of the body).
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, toneMapped: false })
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), lensMat)
    lens.rotation.x = Math.PI / 2 // face -Y
    lens.position.y = -frontOffset
    group.add(lens)

    // Soft halo around the lens.
    const glowMat = new THREE.SpriteMaterial({ map: radialTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })
    const glow = new THREE.Sprite(glowMat)
    glow.position.y = -frontOffset
    glow.scale.set(0.55, 0.55, 0.55)
    group.add(glow)

    // Additive beam cone.
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: true, toneMapped: false,
    })
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1, 8, 1, true), beamMat)
    group.add(beam)

    // Floor/wall pool (added to scene in world space, not the group).
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat)
    scene.add(pool)

    scene.add(group)
    pickList.push(body)

    const fx: FixtureViz = {
      device, profile,
      usedFallbackPos: !device.position,
      usedFallbackRot: !device.rotation,
      fallbackIndex,
      group, body, lens, lensMat, glow, glowMat, beam, beamMat, pool, poolMat, bodyMat,
      beamAngle: profile?.beamAngle ?? DEFAULT_BEAM_ANGLE,
    }
    applyTransformToGroup(fx)
    refreshBeam(fx)
    return fx
  }

  function disposeFixture(fx: FixtureViz) {
    const i = pickList.indexOf(fx.body)
    if (i >= 0) pickList.splice(i, 1)
    scene.remove(fx.group)
    scene.remove(fx.pool)
    fx.body.geometry.dispose(); fx.bodyMat.dispose()
    fx.lens.geometry.dispose(); fx.lensMat.dispose()
    fx.glowMat.dispose()
    fx.beam.geometry.dispose(); fx.beamMat.dispose()
    fx.pool.geometry.dispose(); fx.poolMat.dispose()
  }

  // ── Public: reconcile device list (diff, no full teardown) ──────
  let draggingId: string | null = null
  function setDevices(devices: Device[]) {
    const incoming = new Set(devices.map(d => d.id))
    for (const [id, fx] of fixtures) {
      if (!incoming.has(id)) {
        if (selectedId === id || selectedIds.includes(id)) detachGizmo()
        disposeFixture(fx)
        fixtures.delete(id)
      }
    }
    devices.forEach((device, index) => {
      let fx = fixtures.get(device.id)
      if (!fx) {
        fx = createFixture(device, index)
        fixtures.set(device.id, fx)
        return
      }
      fx.device = device
      fx.fallbackIndex = index
      const newProfile = opts.resolveProfile(device.profileId)
      if (newProfile?.id !== fx.profile?.id) {
        fx.profile = newProfile
        fx.beamAngle = newProfile?.beamAngle ?? DEFAULT_BEAM_ANGLE
      }
      // Don't fight the gizmo for the fixture(s) being dragged.
      const inBlockDrag = blockDragging && selectedIds.includes(device.id)
      if (device.id !== draggingId && !inBlockDrag) {
        applyTransformToGroup(fx)
        refreshBeam(fx)
      }
    })

    // Keep the block pivot on the selection's centroid after external edits
    // (nudge buttons, formations) so the next drag starts from the right place.
    if (!blockDragging && isMulti()) centroidOf(selectedIds, pivot.position)
  }

  function setStage(next: Stage) {
    stage = { width: next.width, depth: next.depth, height: next.height }
    buildRoom()
    for (const fx of fixtures.values()) {
      if (fx.usedFallbackPos) applyTransformToGroup(fx)
      refreshBeam(fx)
    }
    frameCamera()
  }

  // ── Selection + gizmo (edit mode) ──────────────────────────────
  // selectedId = the "primary" (drives single-fixture detail/rotate).
  // selectedIds = full multi-selection. When >1, the gizmo attaches to a
  // pivot proxy and drags every selected fixture as a rigid block.
  let selectedId: string | null = null
  let selectedIds: string[] = []
  let transform: TransformControls | null = null

  const pivot = new THREE.Object3D()
  scene.add(pivot)
  let blockStart: Map<string, THREE.Vector3> | null = null
  let blockDragging = false
  const _pivotStart = new THREE.Vector3()

  function centroidOf(ids: string[], out: THREE.Vector3) {
    let x = 0, y = 0, z = 0, c = 0
    for (const id of ids) {
      const fx = fixtures.get(id)
      if (!fx) continue
      x += fx.group.position.x; y += fx.group.position.y; z += fx.group.position.z; c++
    }
    if (c) out.set(x / c, y / c, z / c)
    return out
  }
  const isMulti = () => selectedIds.length > 1

  function ensureTransform() {
    if (transform || mode !== 'edit') return
    transform = new TransformControls(camera, renderer.domElement)
    transform.setMode(transformMode)
    transform.setSize(0.85)
    // Magnetic by default: positions snap to a 0.5 m grid, rotation to 15 deg.
    transform.setTranslationSnap(POS_SNAP)
    transform.setRotationSnap(ROT_SNAP_DEG * DEG)
    transform.addEventListener('dragging-changed', (e: any) => {
      orbit.enabled = !e.value
      if (isMulti()) {
        if (e.value) {
          // Begin block drag: snapshot pivot + every fixture's start position.
          _pivotStart.copy(pivot.position)
          blockStart = new Map()
          for (const id of selectedIds) {
            const fx = fixtures.get(id)
            if (fx) blockStart.set(id, fx.group.position.clone())
          }
          blockDragging = true
        } else {
          // Commit the block move once (avoids per-frame store churn).
          if (blockStart) {
            for (const id of selectedIds) {
              const fx = fixtures.get(id)
              if (!fx) continue
              opts.onTransform?.(id, { position: { x: fx.group.position.x, y: fx.group.position.y, z: fx.group.position.z } })
              fx.usedFallbackPos = false
            }
          }
          blockStart = null
          blockDragging = false
          centroidOf(selectedIds, pivot.position)
        }
      } else {
        draggingId = e.value ? selectedId : null
      }
    })
    transform.addEventListener('objectChange', () => {
      // Block move: shift every selected fixture by the pivot's delta (keeps
      // their relative layout; the gizmo's translation snap keeps it magnetic).
      if (isMulti()) {
        if (!blockStart) return
        const dx = pivot.position.x - _pivotStart.x
        const dy = pivot.position.y - _pivotStart.y
        const dz = pivot.position.z - _pivotStart.z
        for (const id of selectedIds) {
          const s = blockStart.get(id)
          const fx = fixtures.get(id)
          if (!s || !fx) continue
          fx.group.position.set(s.x + dx, s.y + dy, s.z + dz)
          refreshBeam(fx)
        }
        return
      }
      if (!selectedId) return
      const fx = fixtures.get(selectedId)
      if (!fx) return
      refreshBeam(fx)
      const snapPos = (v: number) => Math.round(v / POS_SNAP) * POS_SNAP
      const snapDeg = (rad: number) => Math.round(rad / DEG / ROT_SNAP_DEG) * ROT_SNAP_DEG
      opts.onTransform?.(selectedId, {
        position: { x: snapPos(fx.group.position.x), y: snapPos(fx.group.position.y), z: snapPos(fx.group.position.z) },
        rotation: { x: snapDeg(fx.group.rotation.x), y: snapDeg(fx.group.rotation.y), z: snapDeg(fx.group.rotation.z) },
      })
      fx.usedFallbackPos = false
      fx.usedFallbackRot = false
    })
    scene.add(transform.getHelper())
  }

  function detachGizmo() {
    transform?.detach()
  }

  // Attach the gizmo to a single fixture, or to the pivot for a block.
  function setSelection(ids: string[]) {
    selectedIds = ids.slice()
    selectedId = selectedIds[selectedIds.length - 1] ?? null
    if (mode !== 'edit') return
    ensureTransform()
    if (!transform) return
    if (isMulti()) {
      centroidOf(selectedIds, pivot.position)
      pivot.rotation.set(0, 0, 0)
      pivot.updateMatrixWorld(true)
      transform.setMode('translate') // block = move only (rotate stays per-fixture)
      transform.attach(pivot)
    } else if (selectedId && fixtures.has(selectedId)) {
      transform.setMode(transformMode)
      transform.attach(fixtures.get(selectedId)!.group)
    } else {
      transform.detach()
    }
  }
  // Back-compat single-select wrapper.
  function setSelected(id: string | null) { setSelection(id ? [id] : []) }

  function setTransformMode(m: TransformMode) {
    transformMode = m
    if (!isMulti()) transform?.setMode(m)
  }
  function getTransformMode() { return transformMode }

  function setMode(m: 'view' | 'edit') {
    mode = m
    if (m === 'edit') {
      ensureTransform()
      setSelection(selectedIds)
    } else {
      detachGizmo()
    }
  }

  // ── Pointer selection (edit mode) ──────────────────────────────
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downX = 0, downY = 0, downOnGizmo = false

  function onPointerDown(e: PointerEvent) {
    if (mode !== 'edit') return
    downX = e.clientX; downY = e.clientY
    downOnGizmo = !!(transform && (transform as any).axis)
  }
  function onPointerUp(e: PointerEvent) {
    if (mode !== 'edit') return
    if (downOnGizmo || (transform && transform.dragging)) return
    if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return // was a drag/orbit
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(pickList, false)
    if (hits.length > 0) {
      const id = hits[0]!.object.userData.deviceId as string
      opts.onSelect?.(id)
    }
    // Click on empty space keeps the current selection (deselect via button).
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  // ── Per-frame render ───────────────────────────────────────────
  const clock = new THREE.Clock()
  let raf = 0
  let frameRef: number[] = []

  function tick() {
    raf = requestAnimationFrame(tick)
    const elapsed = clock.getElapsedTime()
    frameRef = opts.getFrame()

    for (const fx of fixtures.values()) {
      let brightness = 0
      let r = 0, g = 0, b = 0
      let active = false

      if (fx.profile) {
        const st = decodeFixture(frameRef, fx.device, fx.profile)
        active = st.active
        if (active) {
          brightness = st.intensity01
          // Fold white into rgb so a white-only fixture still glows.
          r = Math.min(255, st.rgb[0] + st.white)
          g = Math.min(255, st.rgb[1] + st.white)
          b = Math.min(255, st.rgb[2] + st.white)
          if (r + g + b === 0) { r = g = b = 255 } // safety: visible but colorless
          if (st.strobe) {
            const freq = 3 + st.strobeSpeed01 * (22 - 3)
            const on = (elapsed * freq) % 1 < 0.5 ? 1 : 0
            brightness *= on
          }
        }
      }

      const lit = active && brightness > 0.001
      _color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)

      // Lens: solid disc, color scaled by brightness.
      fx.lensMat.color.copy(_color).multiplyScalar(0.15 + 0.85 * brightness)
      // Body: tinted to its color when lit, but ALWAYS keeps a dim emissive floor
      // so the physical fixture is visible (and clickable) even when off.
      if (lit) {
        fx.bodyMat.emissive.copy(_color).multiplyScalar(0.18 * brightness)
      } else {
        fx.bodyMat.emissive.setRGB(0.05, 0.06, 0.08)
      }

      // In edit mode, show a faint white preview beam for fixtures that are off,
      // so you can see where each light points while positioning the rig.
      const preview = !lit && mode === 'edit'
      fx.beam.visible = lit || preview
      fx.pool.visible = lit || preview
      fx.glow.visible = lit || preview
      if (lit) {
        fx.beamMat.color.copy(_color)
        fx.beamMat.opacity = 0.12 + 0.32 * brightness
        fx.glowMat.color.copy(_color)
        fx.glowMat.opacity = 0.5 + 0.5 * brightness
        const gs = 0.3 + 0.35 * brightness
        fx.glow.scale.set(gs, gs, gs)
        fx.poolMat.color.copy(_color)
        fx.poolMat.opacity = 0.25 + 0.5 * brightness
      } else if (preview) {
        _color.setRGB(0.7, 0.8, 1, THREE.SRGBColorSpace)
        fx.beamMat.color.copy(_color)
        fx.beamMat.opacity = 0.14
        fx.glowMat.color.copy(_color)
        fx.glowMat.opacity = 0.5
        fx.glow.scale.set(0.3, 0.3, 0.3)
        fx.poolMat.color.copy(_color)
        fx.poolMat.opacity = 0.18
      }
    }

    // Beat-pulse ring: expand + fade across each beat (no allocations).
    const bp = opts.getBeat?.()
    if (bp?.isPlaying) {
      const p = ((bp.phase % 1) + 1) % 1 // 0..1 intra-beat
      const k = 1 - p
      beatRing.scale.setScalar(0.5 + p * Math.min(stage.width, stage.depth) * 0.5)
      ringMat.opacity = 0.35 * k * k
    } else {
      ringMat.opacity = 0
    }

    orbit.update()
    renderer.render(scene, camera)
  }

  // ── Mount / resize / dispose ───────────────────────────────────
  let container: HTMLElement | null = null
  let ro: ResizeObserver | null = null

  function resize() {
    if (!container) return
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }

  function mount(el: HTMLElement) {
    container = el
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    buildRoom()
    frameCamera()
    resize()
    ro = new ResizeObserver(() => resize())
    ro.observe(el)
    if (mode === 'edit') ensureTransform()
    tick()
  }

  function dispose() {
    cancelAnimationFrame(raf)
    ro?.disconnect()
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    for (const fx of fixtures.values()) disposeFixture(fx)
    fixtures.clear()
    for (const geo of roomGeoms) geo.dispose()
    for (const m of roomMats) m.dispose()
    if (transform) {
      transform.detach()
      transform.dispose()
    }
    orbit.dispose()
    radialTex.dispose()
    ringGeo.dispose()
    ringMat.dispose()
    renderer.dispose()
    if (container && renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
    container = null
  }

  return {
    mount,
    setStage,
    setDevices,
    setSelected,
    setSelection,
    setMode,
    setTransformMode,
    getTransformMode,
    setCameraView,
    resize,
    dispose,
  }
}

export type StageSceneController = ReturnType<typeof createStageScene>
