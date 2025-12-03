<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { TRACK_COLORS } from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const store = useDMXStore()

const devicesExpanded = ref(true)
const groupsExpanded = ref(true)

// Add device dialog
const showAddDevice = ref(false)
const newDeviceName = ref('')
const newDeviceChannel = ref(1)

function handleAddDevice() {
  if (!newDeviceName.value.trim()) return

  store.addDevice({
    name: newDeviceName.value.trim(),
    profileId: 'pinspot-rgbw-5ch',
    startChannel: newDeviceChannel.value,
    tags: [],
  })

  newDeviceName.value = ''
  newDeviceChannel.value = Math.min(512, newDeviceChannel.value + 5)
  showAddDevice.value = false
}

// Add group dialog
const showAddGroup = ref(false)
const newGroupName = ref('')
const selectedDevicesForGroup = ref<string[]>([])

function handleAddGroup() {
  if (!newGroupName.value.trim() || selectedDevicesForGroup.value.length === 0) return

  store.addGroup({
    name: newGroupName.value.trim(),
    profileId: 'pinspot-rgbw-5ch',
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
          class="group flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-all duration-200
                 border-l-2"
          :class="store.selectedDeviceId.value === device.id
            ? 'bg-green-500/10 border-green-500 shadow-[inset_0_0_20px_#22c55e08]'
            : 'border-transparent hover:bg-zinc-800/40 hover:border-green-500/30'"
          @click="store.selectDevice(device.id)"
        >
          <span class="text-sm text-zinc-300 group-hover:text-white transition-colors"
                :class="{ 'text-green-400': store.selectedDeviceId.value === device.id }">
            {{ device.name }}
          </span>
          <span class="ml-auto text-xs font-mono text-zinc-600">CH {{ device.startChannel }}</span>
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

    <!-- Add Device Dialog -->
    <Dialog :open="showAddDevice" @update:open="showAddDevice = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Device</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="device-name">Name</Label>
            <Input
              id="device-name"
              v-model="newDeviceName"
              placeholder="e.g. Pinspot 1"
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
            <Label>Select Devices</Label>
            <div class="device-picker">
              <div
                v-for="device in store.devices.value"
                :key="device.id"
                class="device-option"
                @click="toggleDeviceForGroup(device.id)"
              >
                <Checkbox
                  :checked="selectedDevicesForGroup.includes(device.id)"
                  @update:checked="toggleDeviceForGroup(device.id)"
                />
                <span class="ml-2">{{ device.name }}</span>
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
  </div>
</template>

<style scoped>
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
</style>
