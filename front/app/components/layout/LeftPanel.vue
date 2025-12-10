<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { TRACK_COLORS, DEVICE_PROFILES, getProfileById } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const store = useDMXStore()

const devicesExpanded = ref(true)
const groupsExpanded = ref(true)
const scenesExpanded = ref(true)

// Add device dialog
const showAddDevice = ref(false)
const newDeviceName = ref('')
const newDeviceChannel = ref(1)
const newDeviceProfileId = ref('pinspot-rgbw-5ch')

function handleAddDevice() {
  if (!newDeviceName.value.trim()) return

  const profile = getProfileById(newDeviceProfileId.value)
  const channelCount = profile?.channelCount || 5

  store.addDevice({
    name: newDeviceName.value.trim(),
    profileId: newDeviceProfileId.value,
    startChannel: newDeviceChannel.value,
    tags: [],
  })

  newDeviceName.value = ''
  newDeviceChannel.value = Math.min(512, newDeviceChannel.value + channelCount)
  showAddDevice.value = false
}

// Get short profile label for device list
function getProfileLabel(profileId: string): string {
  const profile = getProfileById(profileId)
  if (!profile) return '?'
  if (profileId === 'pinspot-rgbw-5ch') return 'RGBW'
  if (profileId === 'laser-10ch') return 'LASER'
  return profile.name.substring(0, 4).toUpperCase()
}

// Add group dialog
const showAddGroup = ref(false)
const newGroupName = ref('')
const selectedDevicesForGroup = ref<string[]>([])

// Get profile from first selected device
const groupProfileId = computed(() => {
  if (selectedDevicesForGroup.value.length === 0) return null
  const firstDevice = store.devices.value.find(d => d.id === selectedDevicesForGroup.value[0])
  return firstDevice?.profileId || null
})

// Filter devices that match the selected profile (for group consistency)
const compatibleDevicesForGroup = computed(() => {
  if (!groupProfileId.value) return store.devices.value
  return store.devices.value.filter(d => d.profileId === groupProfileId.value)
})

function handleAddGroup() {
  if (!newGroupName.value.trim() || selectedDevicesForGroup.value.length === 0 || !groupProfileId.value) return

  store.addGroup({
    name: newGroupName.value.trim(),
    profileId: groupProfileId.value,
    deviceIds: [...selectedDevicesForGroup.value],
    color: TRACK_COLORS[store.groups.value.length % TRACK_COLORS.length],
  })

  newGroupName.value = ''
  selectedDevicesForGroup.value = []
  showAddGroup.value = false
}

function toggleDeviceForGroup(deviceId: string) {
  const idx = selectedDevicesForGroup.value.indexOf(deviceId)
  if (idx === -1) {
    selectedDevicesForGroup.value.push(deviceId)
  } else {
    selectedDevicesForGroup.value.splice(idx, 1)
  }
}

function isDeviceCompatibleForGroup(deviceId: string): boolean {
  if (!groupProfileId.value) return true
  const device = store.devices.value.find(d => d.id === deviceId)
  return device?.profileId === groupProfileId.value
}

// Create v-model compatible getters for checkboxes (Add Group dialog)
function getDeviceCheckedForGroup(deviceId: string): boolean {
  return selectedDevicesForGroup.value.includes(deviceId)
}

function setDeviceCheckedForGroup(deviceId: string, checked: boolean) {
  if (checked) {
    if (!selectedDevicesForGroup.value.includes(deviceId)) {
      selectedDevicesForGroup.value.push(deviceId)
    }
  } else {
    const idx = selectedDevicesForGroup.value.indexOf(deviceId)
    if (idx !== -1) {
      selectedDevicesForGroup.value.splice(idx, 1)
    }
  }
}

// Edit device dialog
const showEditDevice = ref(false)
const editingDeviceId = ref<string | null>(null)
const editDeviceName = ref('')
const editDeviceChannel = ref(1)

function openEditDevice(device: { id: string, name: string, startChannel: number }) {
  editingDeviceId.value = device.id
  editDeviceName.value = device.name
  editDeviceChannel.value = device.startChannel
  showEditDevice.value = true
}

function handleEditDevice() {
  if (!editingDeviceId.value || !editDeviceName.value.trim()) return

  store.updateDevice(editingDeviceId.value, {
    name: editDeviceName.value.trim(),
    startChannel: editDeviceChannel.value,
  })

  showEditDevice.value = false
  editingDeviceId.value = null
}

function handleDeleteDevice() {
  if (!editingDeviceId.value) return
  store.deleteDevice(editingDeviceId.value)
  showEditDevice.value = false
  editingDeviceId.value = null
}

// Edit group dialog
const showEditGroup = ref(false)
const editingGroupId = ref<string | null>(null)
const editGroupName = ref('')
const editGroupDevices = ref<string[]>([])

// Get the profile of the group being edited (for device filtering)
const editingGroupProfile = computed(() => {
  if (!editingGroupId.value) return null
  const group = store.groups.value.find(g => g.id === editingGroupId.value)
  return group?.profileId || null
})

function openEditGroup(group: { id: string, name: string, deviceIds: string[] }) {
  editingGroupId.value = group.id
  editGroupName.value = group.name
  editGroupDevices.value = [...group.deviceIds]
  showEditGroup.value = true
}

function toggleDeviceForEditGroup(deviceId: string) {
  const idx = editGroupDevices.value.indexOf(deviceId)
  if (idx === -1) {
    editGroupDevices.value.push(deviceId)
  } else {
    editGroupDevices.value.splice(idx, 1)
  }
}

function isDeviceCompatibleForEditGroup(deviceId: string): boolean {
  if (!editingGroupProfile.value) return true
  const device = store.devices.value.find(d => d.id === deviceId)
  return device?.profileId === editingGroupProfile.value
}

// Create v-model compatible getters for checkboxes (Edit Group dialog)
function getDeviceCheckedForEditGroup(deviceId: string): boolean {
  return editGroupDevices.value.includes(deviceId)
}

function setDeviceCheckedForEditGroup(deviceId: string, checked: boolean) {
  if (checked) {
    if (!editGroupDevices.value.includes(deviceId)) {
      editGroupDevices.value.push(deviceId)
    }
  } else {
    const idx = editGroupDevices.value.indexOf(deviceId)
    if (idx !== -1) {
      editGroupDevices.value.splice(idx, 1)
    }
  }
}

function handleEditGroup() {
  if (!editingGroupId.value || !editGroupName.value.trim() || editGroupDevices.value.length === 0) return

  store.updateGroup(editingGroupId.value, {
    name: editGroupName.value.trim(),
    deviceIds: [...editGroupDevices.value],
  })

  showEditGroup.value = false
  editingGroupId.value = null
}

function handleDeleteGroup() {
  if (!editingGroupId.value) return
  store.deleteGroup(editingGroupId.value)
  showEditGroup.value = false
  editingGroupId.value = null
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- ═══════════════════════════════════════════════════════════
         DEVICES SECTION
         ═══════════════════════════════════════════════════════════ -->
    <section class="border-b border-zinc-800/50">
      <!-- Section Header with LED indicator -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="devicesExpanded = !devicesExpanded"
      >
        <!-- LED indicator -->
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="store.devices.value.length > 0
            ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
            : 'bg-zinc-700'"
        />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Devices</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ String(store.devices.value.length).padStart(2, '0') }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="devicesExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <!-- Device List -->
      <div v-if="devicesExpanded" class="px-2 py-2">
        <div
          v-for="device in store.devices.value"
          :key="device.id"
          class="group flex items-center gap-2 px-3 py-2.5 rounded cursor-pointer transition-all duration-200
                 border-l-2"
          :class="store.selectedDeviceId.value === device.id
            ? 'bg-green-500/10 border-green-500 shadow-[inset_0_0_20px_#22c55e08]'
            : 'border-transparent hover:bg-zinc-800/40 hover:border-green-500/30'"
          @click="store.selectDevice(device.id)"
        >
          <span
            class="px-1.5 py-0.5 text-[9px] font-bold rounded"
            :class="device.profileId === 'laser-10ch'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-cyan-500/20 text-cyan-400'"
          >
            {{ getProfileLabel(device.profileId) }}
          </span>
          <span class="text-sm text-zinc-300 group-hover:text-white transition-colors truncate"
                :class="{ 'text-green-400': store.selectedDeviceId.value === device.id }">
            {{ device.name }}
          </span>
          <span class="ml-auto text-[10px] font-mono text-zinc-500 shrink-0">CH{{ device.startChannel }}</span>
          <!-- Edit button -->
          <button
            class="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-green-400 transition-all"
            title="Edit device"
            @click.stop="openEditDevice(device)"
          >
            ✎
          </button>
        </div>

        <div v-if="store.devices.value.length === 0" class="py-6 text-center text-zinc-400 text-xs">
          No devices yet
        </div>

        <!-- Add Device Button -->
        <button
          class="w-full mt-2 py-2.5 rounded-lg border border-dashed border-zinc-600
                 text-zinc-400 text-xs font-medium
                 hover:border-green-500/50 hover:text-green-400
                 hover:bg-green-500/5 hover:shadow-[0_0_20px_#22c55e08]
                 transition-all duration-300"
          @click="showAddDevice = true"
        >
          + Add Device
        </button>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         GROUPS SECTION
         ═══════════════════════════════════════════════════════════ -->
    <section class="border-b border-zinc-800/50">
      <!-- Section Header with LED indicator -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="groupsExpanded = !groupsExpanded"
      >
        <!-- LED indicator -->
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="store.groups.value.length > 0
            ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
            : 'bg-zinc-700'"
        />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Groups</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ String(store.groups.value.length).padStart(2, '0') }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="groupsExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <!-- Group List -->
      <div v-if="groupsExpanded" class="px-2 py-2">
        <div
          v-for="group in store.groups.value"
          :key="group.id"
          class="group flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-all duration-200
                 border-l-2"
          :class="store.selectedGroupId.value === group.id
            ? 'bg-green-500/10 border-green-500 shadow-[inset_0_0_20px_#22c55e08]'
            : 'border-transparent hover:bg-zinc-800/40 hover:border-green-500/30'"
          @click="store.selectGroup(group.id)"
        >
          <!-- Group color indicator with glow -->
          <span
            class="w-3 h-3 rounded-sm flex-shrink-0 shadow-[0_0_8px_var(--glow-color)]"
            :style="{ backgroundColor: group.color, '--glow-color': group.color + '60' }"
          />
          <span class="text-sm text-zinc-300 group-hover:text-white transition-colors"
                :class="{ 'text-green-400': store.selectedGroupId.value === group.id }">
            {{ group.name }}
          </span>
          <span class="ml-auto text-xs font-mono text-zinc-600">{{ group.deviceIds.length }}</span>
          <!-- Edit button -->
          <button
            class="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-green-400 transition-all"
            title="Edit group"
            @click.stop="openEditGroup(group)"
          >
            ✎
          </button>
        </div>

        <div v-if="store.groups.value.length === 0" class="py-6 text-center text-zinc-400 text-xs">
          No groups yet
        </div>

        <!-- Add Group Button -->
        <button
          class="w-full mt-2 py-2.5 rounded-lg border border-dashed border-zinc-600
                 text-zinc-400 text-xs font-medium
                 hover:border-green-500/50 hover:text-green-400
                 hover:bg-green-500/5 hover:shadow-[0_0_20px_#22c55e08]
                 transition-all duration-300
                 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-600 disabled:hover:text-zinc-400 disabled:hover:bg-transparent disabled:hover:shadow-none"
          :disabled="store.devices.value.length === 0"
          @click="showAddGroup = true"
        >
          + Add Group
        </button>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════
         SCENES SECTION
         ═══════════════════════════════════════════════════════════ -->
    <section class="border-b border-zinc-800/50">
      <!-- Section Header with LED indicator -->
      <button
        class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/50
               hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
        @click="scenesExpanded = !scenesExpanded"
      >
        <div
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="store.scenes.value.length > 0
            ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
            : 'bg-zinc-700'"
        />
        <span class="text-xs font-mono uppercase tracking-widest text-green-400">Scenes</span>
        <span class="ml-auto text-xs font-mono text-zinc-500">
          {{ String(store.scenes.value.length).padStart(2, '0') }}
        </span>
        <span class="text-zinc-600 text-[10px] transition-transform duration-200"
              :class="scenesExpanded ? 'rotate-0' : '-rotate-90'">▼</span>
      </button>

      <div v-if="scenesExpanded" class="px-2 py-2">
        <div
          v-for="scene in store.scenes.value"
          :key="scene.id"
          class="group flex flex-col gap-0.5 px-3 py-2.5 rounded cursor-pointer transition-all duration-200
                 border-l-2"
          :class="store.selectedSceneId.value === scene.id
            ? 'bg-green-500/10 border-green-500 shadow-[inset_0_0_20px_#22c55e08]'
            : 'border-transparent hover:bg-zinc-800/40 hover:border-green-500/30'"
          @click="store.selectScene(scene.id)"
        >
          <span class="text-sm text-zinc-300 group-hover:text-white transition-colors"
                :class="{ 'text-green-400': store.selectedSceneId.value === scene.id }">
            {{ scene.name }}
          </span>
          <span class="text-[10px] font-mono text-zinc-500">
            {{ scene.tracks.length }} tracks · {{ scene.clips.length }} clips
          </span>
        </div>

        <div v-if="store.scenes.value.length === 0" class="py-6 text-center text-zinc-400 text-xs">
          No scenes yet. Save a Set as Scene in the editor.
        </div>
      </div>
    </section>

    <!-- Add Device Dialog -->
    <Dialog :open="showAddDevice" @update:open="showAddDevice = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Device</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>Profile</Label>
            <div class="profile-picker">
              <button
                v-for="profile in DEVICE_PROFILES"
                :key="profile.id"
                class="profile-option"
                :class="{ selected: newDeviceProfileId === profile.id }"
                @click="newDeviceProfileId = profile.id"
              >
                <span class="profile-name">{{ profile.name }}</span>
                <span class="profile-channels">{{ profile.channelCount }}ch</span>
              </button>
            </div>
          </div>

          <div class="grid gap-2">
            <Label for="device-name">Name</Label>
            <Input
              id="device-name"
              v-model="newDeviceName"
              :placeholder="newDeviceProfileId === 'laser-10ch' ? 'e.g. Laser 1' : 'e.g. Pinspot 1'"
              @keyup.enter="handleAddDevice"
            />
          </div>

          <div class="grid gap-2">
            <Label for="device-channel">Start Channel (1-512)</Label>
            <Input
              id="device-channel"
              v-model.number="newDeviceChannel"
              type="number"
              min="1"
              max="512"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAddDevice = false">Cancel</Button>
          <Button @click="handleAddDevice">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Group Dialog -->
    <Dialog :open="showAddGroup" @update:open="showAddGroup = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Group</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="group-name">Name</Label>
            <Input
              id="group-name"
              v-model="newGroupName"
              placeholder="e.g. Left Lights"
              @keyup.enter="handleAddGroup"
            />
          </div>

          <div class="grid gap-2">
            <Label>Select Devices <span v-if="groupProfileId" class="text-zinc-500 font-normal">({{ getProfileLabel(groupProfileId) }} only)</span></Label>
            <div class="device-picker">
              <div
                v-for="device in store.devices.value"
                :key="device.id"
                class="device-option"
                :class="{ incompatible: !isDeviceCompatibleForGroup(device.id) }"
                @click="isDeviceCompatibleForGroup(device.id) && toggleDeviceForGroup(device.id)"
              >
                <Checkbox
                  :model-value="getDeviceCheckedForGroup(device.id)"
                  :disabled="!isDeviceCompatibleForGroup(device.id)"
                  @update:model-value="(checked) => setDeviceCheckedForGroup(device.id, checked === true)"
                />
                <span
                  class="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded"
                  :class="device.profileId === 'laser-10ch'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-cyan-500/20 text-cyan-400'"
                >
                  {{ getProfileLabel(device.profileId) }}
                </span>
                <span class="ml-1">{{ device.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showAddGroup = false">Cancel</Button>
          <Button :disabled="selectedDevicesForGroup.length === 0" @click="handleAddGroup">
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Device Dialog -->
    <Dialog :open="showEditDevice" @update:open="showEditDevice = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="edit-device-name">Name</Label>
            <Input
              id="edit-device-name"
              v-model="editDeviceName"
              placeholder="e.g. Pinspot 1"
              @keyup.enter="handleEditDevice"
            />
          </div>

          <div class="grid gap-2">
            <Label for="edit-device-channel">Start Channel (1-512)</Label>
            <Input
              id="edit-device-channel"
              v-model.number="editDeviceChannel"
              type="number"
              min="1"
              max="512"
            />
          </div>
        </div>

        <DialogFooter class="flex justify-between">
          <Button variant="destructive" @click="handleDeleteDevice">Delete</Button>
          <div class="flex gap-2">
            <Button variant="outline" @click="showEditDevice = false">Cancel</Button>
            <Button @click="handleEditDevice">Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Group Dialog -->
    <Dialog :open="showEditGroup" @update:open="showEditGroup = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="edit-group-name">Name</Label>
            <Input
              id="edit-group-name"
              v-model="editGroupName"
              placeholder="e.g. Left Lights"
              @keyup.enter="handleEditGroup"
            />
          </div>

          <div class="grid gap-2">
            <Label>
              Devices
              <span v-if="editingGroupProfile" class="text-zinc-500 font-normal">({{ getProfileLabel(editingGroupProfile) }} only)</span>
            </Label>
            <div class="device-picker">
              <div
                v-for="device in store.devices.value"
                :key="device.id"
                class="device-option"
                :class="{ incompatible: !isDeviceCompatibleForEditGroup(device.id) }"
                @click="isDeviceCompatibleForEditGroup(device.id) && toggleDeviceForEditGroup(device.id)"
              >
                <Checkbox
                  :model-value="getDeviceCheckedForEditGroup(device.id)"
                  :disabled="!isDeviceCompatibleForEditGroup(device.id)"
                  @update:model-value="(checked) => setDeviceCheckedForEditGroup(device.id, checked === true)"
                />
                <span
                  class="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded"
                  :class="device.profileId === 'laser-10ch'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-cyan-500/20 text-cyan-400'"
                >
                  {{ getProfileLabel(device.profileId) }}
                </span>
                <span class="ml-1">{{ device.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="flex justify-between">
          <Button variant="destructive" @click="handleDeleteGroup">Delete</Button>
          <div class="flex gap-2">
            <Button variant="outline" @click="showEditGroup = false">Cancel</Button>
            <Button :disabled="editGroupDevices.length === 0" @click="handleEditGroup">Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Profile picker */
.profile-picker {
  display: flex;
  gap: 8px;
}

.profile-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid #383944;
  border-radius: 8px;
  background: #22232b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-option:hover {
  background: #2a2b35;
  border-color: #22c55e40;
}

.profile-option.selected {
  background: #22c55e15;
  border-color: #22c55e;
  box-shadow: 0 0 15px #22c55e20;
}

.profile-name {
  font-size: 12px;
  font-weight: 500;
  color: #f0f0f5;
}

.profile-option.selected .profile-name {
  color: #22c55e;
}

.profile-channels {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: #8888a0;
}

/* Device picker in dialog */
.device-picker {
  max-height: 192px;
  overflow-y: auto;
  border: 1px solid #383944;
  border-radius: 8px;
  background: #22232b;
}

.device-option {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s ease;
}

.device-option:hover {
  background: #2a2b35;
}

.device-option.incompatible {
  opacity: 0.4;
  pointer-events: none;
}
</style>
