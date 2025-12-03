<script setup lang="ts">
import { useDMXStore } from '~/composables/useDMXStore'
import { TRACK_COLORS } from '~/types/dmx'

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
  <div class="left-panel">
    <!-- Devices Section -->
    <section class="panel-section">
      <button
        class="section-header"
        @click="devicesExpanded = !devicesExpanded"
      >
        <span class="section-title">Devices</span>
        <span class="section-count">{{ store.devices.value.length }}</span>
        <span class="chevron">{{ devicesExpanded ? '▼' : '▶' }}</span>
      </button>

      <div v-if="devicesExpanded" class="section-content">
        <div
          v-for="device in store.devices.value"
          :key="device.id"
          class="list-item"
          :class="{ selected: store.selectedDeviceId.value === device.id }"
          @click="store.selectDevice(device.id)"
        >
          <span class="item-name">{{ device.name }}</span>
          <span class="item-channel">CH {{ device.startChannel }}</span>
        </div>

        <div v-if="store.devices.value.length === 0" class="empty-state">
          No devices yet
        </div>

        <button
          class="add-button"
          @click="showAddDevice = true"
        >
          + Add Device
        </button>
      </div>
    </section>

    <!-- Groups Section -->
    <section class="panel-section">
      <button
        class="section-header"
        @click="groupsExpanded = !groupsExpanded"
      >
        <span class="section-title">Groups</span>
        <span class="section-count">{{ store.groups.value.length }}</span>
        <span class="chevron">{{ groupsExpanded ? '▼' : '▶' }}</span>
      </button>

      <div v-if="groupsExpanded" class="section-content">
        <div
          v-for="group in store.groups.value"
          :key="group.id"
          class="list-item group-item"
          :class="{ selected: store.selectedGroupId.value === group.id }"
          @click="store.selectGroup(group.id)"
        >
          <span
            class="group-color"
            :style="{ backgroundColor: group.color }"
          />
          <span class="item-name">{{ group.name }}</span>
          <span class="item-count">{{ group.deviceIds.length }}</span>
        </div>

        <div v-if="store.groups.value.length === 0" class="empty-state">
          No groups yet
        </div>

        <button
          class="add-button"
          :disabled="store.devices.value.length === 0"
          @click="showAddGroup = true"
        >
          + Add Group
        </button>
      </div>
    </section>

    <!-- Add Device Dialog -->
    <Teleport to="body">
      <div v-if="showAddDevice" class="dialog-overlay" @click.self="showAddDevice = false">
        <div class="dialog">
          <h3 class="dialog-title">Add Device</h3>

          <div class="form-group">
            <label>Name</label>
            <input
              v-model="newDeviceName"
              type="text"
              placeholder="e.g. Pinspot 1"
              class="form-input"
              @keyup.enter="handleAddDevice"
            >
          </div>

          <div class="form-group">
            <label>Start Channel (1-512)</label>
            <input
              v-model.number="newDeviceChannel"
              type="number"
              min="1"
              max="512"
              class="form-input"
            >
          </div>

          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="showAddDevice = false">Cancel</button>
            <button class="btn btn-primary" @click="handleAddDevice">Add</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add Group Dialog -->
    <Teleport to="body">
      <div v-if="showAddGroup" class="dialog-overlay" @click.self="showAddGroup = false">
        <div class="dialog">
          <h3 class="dialog-title">Add Group</h3>

          <div class="form-group">
            <label>Name</label>
            <input
              v-model="newGroupName"
              type="text"
              placeholder="e.g. Left Lights"
              class="form-input"
              @keyup.enter="handleAddGroup"
            >
          </div>

          <div class="form-group">
            <label>Select Devices</label>
            <div class="device-picker">
              <div
                v-for="device in store.devices.value"
                :key="device.id"
                class="device-option"
                :class="{ selected: selectedDevicesForGroup.includes(device.id) }"
                @click="toggleDeviceForGroup(device.id)"
              >
                <span class="checkbox">{{ selectedDevicesForGroup.includes(device.id) ? '☑' : '☐' }}</span>
                <span>{{ device.name }}</span>
              </div>
            </div>
          </div>

          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="showAddGroup = false">Cancel</button>
            <button
              class="btn btn-primary"
              :disabled="selectedDevicesForGroup.length === 0"
              @click="handleAddGroup"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  border-bottom: 1px solid hsl(var(--border));
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: hsl(var(--foreground));
}

.section-header:hover {
  background: hsl(var(--accent));
}

.section-title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  padding: 2px 6px;
  border-radius: 4px;
}

.chevron {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.section-content {
  padding: 4px 8px 8px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.list-item:hover {
  background: hsl(var(--accent));
}

.list-item.selected {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-channel {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  font-family: monospace;
}

.list-item.selected .item-channel {
  color: hsl(var(--primary-foreground) / 0.7);
}

.group-item {
  gap: 8px;
}

.group-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.item-count {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.list-item.selected .item-count {
  color: hsl(var(--primary-foreground) / 0.7);
}

.empty-state {
  padding: 16px;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.add-button {
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  background: none;
  border: 1px dashed hsl(var(--border));
  border-radius: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-button:hover:not(:disabled) {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

.add-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dialog styles */
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

.form-input {
  width: 100%;
  padding: 8px 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  color: hsl(var(--foreground));
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.device-picker {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.device-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.device-option:hover {
  background: hsl(var(--accent));
}

.device-option.selected {
  background: hsl(var(--primary) / 0.1);
}

.checkbox {
  font-size: 14px;
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
