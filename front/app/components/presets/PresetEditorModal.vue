<script setup lang="ts">
import type { PresetValues, StrobeSpeed, DeviceProfile, Preset } from '~/types/dmx'
import {
  createDefaultValues,
  createDefaultChannelValues,
  getPreviewColor,
  getPresetDisplayColor,
  valuesToDMX,
  getProfileById,
} from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  open: boolean
  deviceId: string              // Target device for preview
  preset?: Preset | null        // Existing preset to edit, or null for new
  beat?: number                 // Which beat this is for (for naming)
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [preset: Omit<Preset, 'id'>]
  discard: []
}>()

const store = useDMXStore()
const { sendDMX } = useUnifiedSerial()

// Get device and profile info
const device = computed(() => store.getDevice(props.deviceId))
const profile = computed((): DeviceProfile | null => {
  if (!device.value) return null
  return getProfileById(device.value.profileId) || null
})
const controlType = computed(() => profile.value?.controlType || 'rgbw')

// Form state - RGBW values
const name = ref('')
const rgbwValues = ref<PresetValues>(createDefaultValues())

// Form state - Generic channel values (for sliders profiles)
const channelValues = ref<number[]>([])

// Track original values for discard
const originalDMX = ref<number[]>([])

// Initialize form when modal opens or preset changes
watch([() => props.open, () => props.preset], ([isOpen]) => {
  if (!isOpen) return

  // Capture original DMX state for discard
  originalDMX.value = new Array(16).fill(0)

  if (props.preset) {
    // Editing existing preset
    name.value = props.preset.name
    if (props.preset.values) {
      rgbwValues.value = { ...props.preset.values }
    }
    if (props.preset.channelValues) {
      channelValues.value = [...props.preset.channelValues]
    }
  } else {
    // Creating new preset
    const beatLabel = props.beat ? ` B${props.beat}` : ''
    const deviceName = device.value?.name || 'Preset'
    name.value = `${deviceName}${beatLabel}`

    if (controlType.value === 'rgbw') {
      rgbwValues.value = createDefaultValues()
    } else if (profile.value) {
      channelValues.value = createDefaultChannelValues(profile.value.id)
    }
  }
}, { immediate: true })

// Preview color for header
const previewColor = computed(() => {
  if (controlType.value === 'rgbw') {
    return getPreviewColor(rgbwValues.value)
  }
  // For sliders, use channel values to compute color
  if (profile.value && channelValues.value.length > 0) {
    const colorChannel = profile.value.channels.find(c => c.name === 'Color')
    if (colorChannel) {
      const colorValue = channelValues.value[colorChannel.offset] || 0
      const hue = (colorValue / 255) * 360
      return `hsl(${hue}, 70%, 50%)`
    }
  }
  return '#8b5cf6'
})

// Live preview - send DMX when values change
watch([rgbwValues, channelValues], () => {
  if (!props.open || !device.value) return

  const dmxArray = new Array(16).fill(0)
  const start = device.value.startChannel - 1

  if (controlType.value === 'rgbw') {
    const channels = valuesToDMX(rgbwValues.value)
    for (let i = 0; i < channels.length && start + i < 16; i++) {
      dmxArray[start + i] = channels[i]
    }
  } else {
    for (let i = 0; i < channelValues.value.length && start + i < 16; i++) {
      dmxArray[start + i] = channelValues.value[i]
    }
  }

  sendDMX(dmxArray)
}, { deep: true })

// Quick color options for RGBW
const quickColors = [
  { name: 'Red', r: 255, g: 0, b: 0 },
  { name: 'Green', r: 0, g: 255, b: 0 },
  { name: 'Blue', r: 0, g: 0, b: 255 },
  { name: 'Cyan', r: 0, g: 255, b: 255 },
  { name: 'Magenta', r: 255, g: 0, b: 255 },
  { name: 'Yellow', r: 255, g: 255, b: 0 },
  { name: 'Orange', r: 255, g: 128, b: 0 },
  { name: 'White', r: 255, g: 255, b: 255 },
]

const strobeOptions: { value: StrobeSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Med' },
  { value: 'fast', label: 'Fast' },
]

function setQuickColor(color: { r: number, g: number, b: number }) {
  rgbwValues.value.red = color.r
  rgbwValues.value.green = color.g
  rgbwValues.value.blue = color.b
}

function handleSave() {
  if (!name.value.trim() || !profile.value) return

  const preset: Omit<Preset, 'id'> = {
    name: name.value.trim(),
    profileId: profile.value.id,
    isBuiltIn: false,
    category: 'custom',
  }

  if (controlType.value === 'rgbw') {
    preset.values = { ...rgbwValues.value }
  } else {
    preset.channelValues = [...channelValues.value]
  }

  emit('save', preset)
  emit('update:open', false)
}

function handleDiscard() {
  // Revert to original DMX state
  if (device.value) {
    sendDMX(originalDMX.value)
  }
  emit('discard')
  emit('update:open', false)
}

function handleCancel() {
  // Revert to original DMX state
  if (device.value) {
    sendDMX(originalDMX.value)
  }
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-lg bg-neutral-900 border-neutral-700 text-white max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg border border-neutral-600"
            :style="{ backgroundColor: previewColor }"
          />
          <div>
            <DialogTitle class="text-white">
              {{ preset ? 'Edit Preset' : 'New Preset' }}
            </DialogTitle>
            <div class="text-xs text-zinc-500">
              {{ device?.name }} · {{ profile?.name }}
            </div>
          </div>
        </div>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <!-- Preset Name -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Name</label>
          <Input
            v-model="name"
            type="text"
            placeholder="e.g. Red Strobe"
            class="bg-neutral-800 border-neutral-600 text-white"
          />
        </div>

        <!-- ════════════════════════════════════════════════════════════
             RGBW CONTROLS (for rgbw profiles like PinSpot)
             ════════════════════════════════════════════════════════════ -->
        <template v-if="controlType === 'rgbw'">
          <!-- Quick Colors -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">Quick Colors</label>
            <div class="grid grid-cols-8 gap-1.5">
              <button
                v-for="color in quickColors"
                :key="color.name"
                class="aspect-square rounded-lg border-2 transition-all"
                :class="
                  rgbwValues.red === color.r && rgbwValues.green === color.g && rgbwValues.blue === color.b
                    ? 'border-white scale-105'
                    : 'border-transparent hover:scale-105'
                "
                :style="{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }"
                :title="color.name"
                @click="setQuickColor(color)"
              />
            </div>
          </div>

          <!-- Dimmer / Strobe Toggle -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-400">Mode</label>
              <div class="flex gap-2">
                <button
                  class="px-3 py-1 rounded text-xs font-medium"
                  :class="!rgbwValues.strobe ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-300'"
                  @click="rgbwValues.strobe = false"
                >
                  Dimmer
                </button>
                <button
                  class="px-3 py-1 rounded text-xs font-medium"
                  :class="rgbwValues.strobe ? 'bg-amber-500 text-black' : 'bg-neutral-700 text-neutral-300'"
                  @click="rgbwValues.strobe = true"
                >
                  Strobe
                </button>
              </div>
            </div>

            <!-- Dimmer Slider -->
            <div v-if="!rgbwValues.strobe" class="flex items-center gap-3">
              <span class="w-14 text-xs text-neutral-400">Dimmer</span>
              <input
                v-model.number="rgbwValues.dimmer"
                type="range"
                min="0"
                max="255"
                class="flex-1 accent-green-500"
              >
              <span class="w-10 text-xs text-neutral-400 text-right font-mono">
                {{ Math.round((rgbwValues.dimmer / 255) * 100) }}%
              </span>
            </div>

            <!-- Strobe Speed -->
            <div v-else class="flex items-center gap-2">
              <span class="text-xs text-neutral-400">Speed:</span>
              <button
                v-for="opt in strobeOptions"
                :key="opt.value"
                class="px-3 py-1 rounded text-xs"
                :class="rgbwValues.strobeSpeed === opt.value ? 'bg-amber-500 text-black' : 'bg-neutral-700 text-neutral-300'"
                @click="rgbwValues.strobeSpeed = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- RGBW Sliders -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">RGBW</label>
            <div class="grid gap-2">
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-red-400">R</span>
                <input v-model.number="rgbwValues.red" type="range" min="0" max="255" class="flex-1 accent-red-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.red }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-green-400">G</span>
                <input v-model.number="rgbwValues.green" type="range" min="0" max="255" class="flex-1 accent-green-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.green }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-blue-400">B</span>
                <input v-model.number="rgbwValues.blue" type="range" min="0" max="255" class="flex-1 accent-blue-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.blue }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-neutral-200">W</span>
                <input v-model.number="rgbwValues.white" type="range" min="0" max="255" class="flex-1 accent-white">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.white }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════
             SLIDER CONTROLS (for profiles like Laser)
             ════════════════════════════════════════════════════════════ -->
        <template v-else-if="controlType === 'sliders' && profile">
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">Channels</label>
            <div class="grid gap-2">
              <div
                v-for="(channel, idx) in profile.channels"
                :key="channel.offset"
                class="channel-row"
              >
                <div class="channel-info">
                  <span class="channel-name">{{ channel.name }}</span>
                  <span v-if="channel.description" class="channel-desc">{{ channel.description }}</span>
                </div>
                <div class="channel-control">
                  <input
                    v-model.number="channelValues[idx]"
                    type="range"
                    :min="channel.min"
                    :max="channel.max"
                    class="channel-slider"
                  >
                  <span class="channel-value">{{ channelValues[idx] }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <DialogFooter class="flex gap-2">
        <Button
          variant="outline"
          class="text-red-400 border-red-500/30 hover:bg-red-500/10"
          @click="handleDiscard"
        >
          Discard
        </Button>
        <div class="flex-1" />
        <Button variant="secondary" @click="handleCancel">Cancel</Button>
        <Button class="bg-green-600 hover:bg-green-700 text-white" @click="handleSave">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Channel sliders for Laser */
.channel-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #22232b;
  border: 1px solid #383944;
  border-radius: 6px;
}

.channel-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.channel-name {
  font-size: 11px;
  font-weight: 500;
  color: #f0f0f5;
}

.channel-desc {
  font-size: 9px;
  color: #8888a0;
  font-family: 'JetBrains Mono', monospace;
}

.channel-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-slider {
  flex: 1;
  height: 6px;
  cursor: pointer;
  accent-color: #8b5cf6;
}

.channel-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  min-width: 28px;
  text-align: right;
  color: #8b5cf6;
}
</style>
